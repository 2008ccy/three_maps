import Foundation

@main
struct LibraryTests {
    static func expectFailure(_ message: String, _ operation: () throws -> Void) {
        do {
            try operation()
            fatalError("操作应被阻止：\(message)")
        } catch {
            precondition(error.localizedDescription.contains(message), error.localizedDescription)
        }
    }

    static func main() throws {
        let fm = FileManager.default
        let source = URL(fileURLWithPath: CommandLine.arguments[1], isDirectory: true)
        let root = fm.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
        let folder = root.appendingPathComponent("website/card-editor", isDirectory: true)
        try fm.createDirectory(at: folder, withIntermediateDirectories: true)
        try fm.copyItem(at: source.appendingPathComponent("website/card-editor/manifest.json"),
                        to: folder.appendingPathComponent("manifest.json"))
        let file = folder.appendingPathComponent("overrides.json")
        let empty = Data("{}\n".utf8)
        try empty.write(to: file)
        let library = try CardLibrary(root: root)
        let lora = "domain:lora", retrieval = "domain:retrieval", token = "domain:token"
        let pair: Set<String> = [lora, retrieval]
        let original = Dictionary(uniqueKeysWithValues: library.cards.map { ($0.id, $0.original) })
        precondition(original[lora] == .unrated && original[retrieval] == .revisit)
        try library.set(.tried, for: pair)
        let reopened = try CardLibrary(root: root)
        precondition(reopened.cards.filter { pair.contains($0.id) }.allSatisfy { reopened.status(of: $0) == .tried })
        try library.undo()
        let restored = try Data(contentsOf: file)
        precondition(restored == empty)
        precondition(library.cards.allSatisfy { library.status(of: $0) == $0.original })

        let other = try CardLibrary(root: root)
        try other.set(.tried, for: [token])
        try library.set(.understood, for: [lora])
        let merged = try JSONDecoder().decode([String: StudyStatus].self, from: Data(contentsOf: file))
        precondition(merged == [token: .tried, lora: .understood])
        expectFailure("外部更改") { try other.set(.revisit, for: [lora, retrieval]) }
        let latest = try CardLibrary(root: root)
        try latest.set(.revisit, for: [lora])
        expectFailure("外部更改") { try library.undo() }
        precondition(library.canUndo)
        try fm.setAttributes([.posixPermissions: 0o444], ofItemAtPath: file.path)
        expectFailure("只读") { try latest.set(.tried, for: [lora]) }
        try fm.setAttributes([.posixPermissions: 0o644], ofItemAtPath: file.path)
        let invalid = Data("{invalid".utf8)
        try invalid.write(to: file)
        expectFailure("无效状态") { try latest.set(.tried, for: pair) }
        let unchanged = try Data(contentsOf: file)
        precondition(unchanged == invalid)
        print("通过：批量保存与撤销、重开持久化、外部修改合并与冲突、只读和损坏文件保护。")
    }
}
