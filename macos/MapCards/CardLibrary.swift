import Darwin
import Foundation

enum StudyStatus: String, CaseIterable, Codable, Identifiable {
    case unrated = "待自评"
    case understood = "已初步理解"
    case tried = "已经尝试"
    case revisit = "待深入学习"
    var id: Self { self }
}

struct StudyCard: Decodable, Identifiable {
    let map: String
    let mapTitle: String
    let node: String
    let title: String
    let original: StudyStatus
    var id: String { "\(map):\(node)" }
}

private struct Manifest: Decodable {
    let statuses: [StudyStatus]
    let cards: [StudyCard]
}

struct LibraryError: LocalizedError {
    let message: String
    var errorDescription: String? { message }
    init(_ message: String) { self.message = message }
}

final class CardLibrary {
    let root: URL
    let cards: [StudyCard]
    private let manifestBytes: Data
    private let cardsByID: [String: StudyCard]
    private let directory: URL
    private var overrides: [String: StudyStatus]

    private struct Edit {
        let before: StudyStatus?
        let after: StudyStatus?
        var reversed: Edit { Edit(before: after, after: before) }
    }
    private var history: [[String: Edit]] = []
    var canUndo: Bool { !history.isEmpty }

    init(root: URL) throws {
        self.root = root.standardizedFileURL
        directory = root.appendingPathComponent("website/card-editor", isDirectory: true)
        let file = directory.appendingPathComponent("manifest.json")
        guard FileManager.default.fileExists(atPath: file.path) else {
            throw LibraryError("请选择包含 website/card-editor/manifest.json 的三张活地图项目文件夹。")
        }
        manifestBytes = try Data(contentsOf: file)
        guard let manifest = try? JSONDecoder().decode(Manifest.self, from: manifestBytes),
              manifest.statuses == StudyStatus.allCases, !manifest.cards.isEmpty,
              Set(manifest.cards.map(\.id)).count == manifest.cards.count else {
            throw LibraryError("卡片清单格式无效或包含重复卡片，请在 website 目录运行 npm run cards:sync 后重新载入。")
        }
        cards = manifest.cards
        cardsByID = Dictionary(uniqueKeysWithValues: cards.map { ($0.id, $0) })
        overrides = try Self.readOverrides(in: directory, cards: cardsByID)
    }

    func status(of card: StudyCard) -> StudyStatus { overrides[card.id] ?? card.original }

    @discardableResult
    func set(_ status: StudyStatus, for ids: Set<String>) throws -> Int {
        var edits: [String: Edit] = [:]
        for id in ids {
            guard let card = cardsByID[id] else { throw LibraryError("卡片已变更，请重新载入项目。") }
            edits[id] = Edit(before: overrides[id], after: status == card.original ? nil : status)
        }
        try commit(edits)
        let changed = edits.filter { $0.value.before != $0.value.after }
        if !changed.isEmpty { history.append(changed) }
        return changed.count
    }

    @discardableResult
    func undo() throws -> Int {
        guard let last = history.last else { return 0 }
        try commit(last.mapValues(\.reversed))
        history.removeLast()
        return last.count
    }

    private static func readOverrides(in directory: URL, cards: [String: StudyCard]) throws -> [String: StudyStatus] {
        let file = directory.appendingPathComponent("overrides.json")
        let data = try Data(contentsOf: file)
        guard let states = try? JSONDecoder().decode([String: StudyStatus].self, from: data),
              states.keys.allSatisfy({ cards[$0] != nil }) else {
            throw LibraryError("overrides.json 含有无效状态或未知卡片。请修复文件后重新载入。")
        }
        return states
    }

    private func commit(_ edits: [String: Edit]) throws {
        // Lock the directory inode: the status file itself is replaced by atomic rename.
        let descriptor = Darwin.open(directory.path, O_RDONLY)
        guard descriptor >= 0 else { throw POSIXError(.init(rawValue: errno) ?? .EIO) }
        defer { Darwin.close(descriptor) }
        guard flock(descriptor, LOCK_EX | LOCK_NB) == 0 else {
            throw LibraryError("其他编辑器正在保存，请稍后重试。")
        }
        defer { flock(descriptor, LOCK_UN) }

        guard try Data(contentsOf: directory.appendingPathComponent("manifest.json")) == manifestBytes else {
            throw LibraryError("卡片清单已在外部更新，请重新载入，再选择卡片。")
        }
        var latest = try Self.readOverrides(in: directory, cards: cardsByID)
        for (id, edit) in edits where latest[id] != edit.before {
            throw LibraryError("「\(cardsByID[id]?.title ?? id)」已在外部更改。请重新载入后再操作。")
        }
        let changed = edits.filter { $0.value.before != $0.value.after }
        if !changed.isEmpty {
            let file = directory.appendingPathComponent("overrides.json")
            guard FileManager.default.isWritableFile(atPath: file.path) else {
                throw LibraryError("overrides.json 为只读文件，请检查写入权限后重试。")
            }
            for (id, edit) in changed { latest[id] = edit.after }
            let encoder = JSONEncoder()
            encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
            var data = latest.isEmpty ? Data("{}".utf8) : try encoder.encode(latest)
            data.append(0x0A)
            try data.write(to: file, options: .atomic)
        }
        overrides = latest
    }
}
