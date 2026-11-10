import AppKit
import SwiftUI

extension StudyStatus {
    var color: Color {
        switch self {
        case .unrated: .secondary
        case .understood: .blue
        case .tried: .teal
        case .revisit: .orange
        }
    }

    var symbol: String {
        switch self {
        case .unrated: "circle.dotted"
        case .understood: "book"
        case .tried: "checkmark.circle"
        case .revisit: "bookmark"
        }
    }
}

@MainActor
final class Editor: ObservableObject {
    @Published private(set) var library: CardLibrary?
    @Published var selected: Set<String> = []
    @Published var map: String?
    @Published var filter: StudyStatus?
    @Published var query = ""
    @Published var notice = ""
    @Published var problem: String?
    @Published var searchRequest = 0

    private let rememberedProject = "mapCards.projectPath"

    init() {
        if let path = UserDefaults.standard.string(forKey: rememberedProject) {
            open(URL(fileURLWithPath: path))
        }
    }

    func open(_ url: URL) {
        do {
            let next = try CardLibrary(root: url)
            let switching = next.root != library?.root
            library = next
            if switching {
                selected = []
                map = nil
                filter = nil
                query = ""
            }
            selected.formIntersection(visible.map(\.id))
            notice = ""
            UserDefaults.standard.set(next.root.path, forKey: rememberedProject)
        } catch { problem = error.localizedDescription }
    }

    func chooseProject() {
        let panel = NSOpenPanel()
        panel.title = "选择三张活地图项目"
        panel.prompt = "打开项目"
        panel.canChooseDirectories = true
        panel.canChooseFiles = false
        panel.directoryURL = library?.root ?? Bundle.main.bundleURL.deletingLastPathComponent()
        if panel.runModal() == .OK, let url = panel.url { open(url) }
    }

    var cards: [StudyCard] { library?.cards ?? [] }

    var visible: [StudyCard] {
        let keyword = query.trimmingCharacters(in: .whitespacesAndNewlines)
        return cards.filter { card in
            (map == nil || card.map == map) &&
            (filter == nil || library?.status(of: card) == filter) &&
            (keyword.isEmpty || card.title.localizedCaseInsensitiveContains(keyword) ||
             card.node.localizedCaseInsensitiveContains(keyword))
        }
    }

    var selection: [StudyCard] { visible.filter { selected.contains($0.id) } }

    func setStatus(_ status: StudyStatus) {
        guard let library, !selection.isEmpty else { return }
        do {
            let count = try library.set(status, for: Set(selection.map(\.id)))
            notice = count > 0 ? "已保存 \(count) 张卡片" : "所选卡片均为「\(status.rawValue)」"
            selected.formIntersection(visible.map(\.id))
        } catch { problem = error.localizedDescription }
    }

    func undo() {
        guard let library, library.canUndo else { return }
        do {
            let count = try library.undo()
            notice = "已撤销 \(count) 张卡片的修改"
            selected.formIntersection(visible.map(\.id))
        } catch { problem = error.localizedDescription }
    }

    func reload() {
        if let root = library?.root { open(root) }
    }
}

@main
struct MapCardsApp: App {
    @StateObject private var editor = Editor()

    var body: some Scene {
        Window("地图卡片", id: "library") {
            LibraryView(editor: editor)
        }
        .defaultSize(width: 900, height: 620)
        .commands {
            CommandGroup(replacing: .newItem) {
                Button("选择项目…", action: editor.chooseProject).keyboardShortcut("o")
                Button("重新载入项目", action: editor.reload).keyboardShortcut("r")
                    .disabled(editor.library == nil)
            }
            CommandGroup(replacing: .undoRedo) {
                Button("撤销学习状态修改", action: editor.undo).keyboardShortcut("z")
                    .disabled(editor.library?.canUndo != true)
            }
            CommandMenu("卡片") {
                Button("搜索卡片") { editor.searchRequest += 1 }.keyboardShortcut("f")
                    .disabled(editor.library == nil)
                Divider()
                ForEach(Array(StudyStatus.allCases.enumerated()), id: \.element) { index, status in
                    Button(status.rawValue) { editor.setStatus(status) }
                        .keyboardShortcut(KeyEquivalent(Character(String(index + 1))))
                        .disabled(editor.selection.isEmpty)
                }
            }
        }
    }
}

struct LibraryView: View {
    @ObservedObject var editor: Editor
    @FocusState private var searching: Bool

    var body: some View {
        Group {
            if let library = editor.library {
                VStack(spacing: 0) {
                    header(library)
                    Divider()
                    cardTable(library)
                    Divider()
                    editBar(library)
                }
            } else {
                VStack(spacing: 18) {
                    Image(systemName: "rectangle.stack.fill").font(.system(size: 46)).foregroundStyle(.teal)
                    Text("打开卡片项目").font(.largeTitle.bold())
                    Text("选择 three_maps 文件夹，即可查看和编辑三张地图的学习状态。")
                        .foregroundStyle(.secondary)
                    Button("选择项目文件夹…", action: editor.chooseProject)
                        .controlSize(.large).buttonStyle(.borderedProminent)
                }.frame(maxWidth: .infinity, maxHeight: .infinity)
            }
        }
        .frame(minWidth: 760, minHeight: 480)
        .onChange(of: editor.searchRequest) { searching = true }
        .onChange(of: editor.visible.map(\.id)) { _, ids in editor.selected.formIntersection(ids) }
        .alert("无法完成操作", isPresented: Binding(
            get: { editor.problem != nil }, set: { if !$0 { editor.problem = nil } }
        )) {
            if editor.library != nil {
                Button("重新载入") { DispatchQueue.main.async { editor.reload() } }
            }
            Button("好", role: .cancel) {}
        } message: { Text(editor.problem ?? "") }
    }

    private func header(_ library: CardLibrary) -> some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack(alignment: .center) {
                Text("学习卡片").font(.largeTitle.bold())
                Spacer()
                Menu {
                    Button("选择其他项目…", action: editor.chooseProject)
                    Button("重新载入项目", action: editor.reload)
                } label: {
                    Label(library.root.lastPathComponent, systemImage: "folder")
                }.fixedSize().help(library.root.path)
            }
            HStack(spacing: 12) {
                HStack(spacing: 7) {
                    Image(systemName: "magnifyingglass").foregroundStyle(.secondary)
                    TextField("搜索标题或节点 ID", text: $editor.query)
                        .accessibilityLabel("搜索卡片").textFieldStyle(.plain).focused($searching)
                    if !editor.query.isEmpty {
                        Button { editor.query = "" } label: { Image(systemName: "xmark.circle.fill") }
                            .buttonStyle(.plain).foregroundStyle(.secondary).accessibilityLabel("清除搜索")
                    }
                }
                .padding(.horizontal, 10).padding(.vertical, 7)
                .background(.quaternary.opacity(0.5), in: RoundedRectangle(cornerRadius: 7))
                Picker("地图", selection: $editor.map) {
                    Text("全部地图").tag(nil as String?)
                    ForEach(library.cards.filter { card in library.cards.first { $0.map == card.map }?.id == card.id }) { card in
                        Text(card.mapTitle).tag(Optional(card.map))
                    }
                }.labelsHidden().fixedSize()
                Picker("学习状态", selection: $editor.filter) {
                    Text("全部状态").tag(nil as StudyStatus?)
                    ForEach(StudyStatus.allCases) { Text($0.rawValue).tag(Optional($0)) }
                }.labelsHidden().fixedSize()
                Text("\(editor.visible.count) / \(library.cards.count) 张")
                    .monospacedDigit().font(.callout).foregroundStyle(.secondary)
            }
        }.padding(.horizontal, 22).padding(.vertical, 16)
    }

    private func cardTable(_ library: CardLibrary) -> some View {
        Table(editor.visible, selection: $editor.selected) {
            TableColumn("卡片") { card in
                VStack(alignment: .leading, spacing: 3) {
                    Text(card.title).font(.body.weight(.medium)).lineLimit(1)
                    Text(card.node).font(.system(.caption, design: .monospaced)).foregroundStyle(.secondary)
                }.padding(.vertical, 4)
            }.width(min: 240, ideal: 380)
            TableColumn("地图", value: \.mapTitle).width(min: 84, ideal: 120, max: 155)
            TableColumn("学习状态") { card in
                let status = library.status(of: card)
                Label(status.rawValue, systemImage: status.symbol).foregroundStyle(status.color)
                    .accessibilityLabel(status.rawValue)
            }.width(min: 104, ideal: 135, max: 165)
        }
        .overlay {
            if editor.visible.isEmpty {
                ContentUnavailableView("没有匹配的卡片", systemImage: "magnifyingglass", description: Text("试试其他关键词或筛选条件。"))
                    .allowsHitTesting(false)
            }
        }
    }

    private func editBar(_ library: CardLibrary) -> some View {
        let selected = editor.selection
        let states = Set(selected.map { library.status(of: $0) })
        return VStack(alignment: .leading, spacing: 10) {
            HStack {
                if selected.isEmpty {
                    Text("选择卡片以修改状态").font(.headline)
                    Text("⌘ 或 Shift 多选").font(.callout).foregroundStyle(.secondary)
                } else {
                    Text("已选 \(selected.count) 张").font(.headline)
                    Text(states.count == 1 ? states.first!.rawValue : "多种状态")
                        .font(.callout).foregroundStyle(.secondary)
                }
                Spacer()
                if !editor.notice.isEmpty {
                    Text(editor.notice).font(.callout).foregroundStyle(.secondary)
                }
                Button { editor.undo() } label: { Label("撤销", systemImage: "arrow.uturn.backward") }
                    .disabled(!library.canUndo).help("撤销学习状态修改（⌘Z）")
            }
            HStack(spacing: 9) {
                ForEach(Array(StudyStatus.allCases.enumerated()), id: \.element) { index, status in
                    Button { editor.setStatus(status) } label: {
                        HStack {
                            Image(systemName: status.symbol).foregroundStyle(status.color)
                            Text(status.rawValue)
                            Spacer(minLength: 4)
                            Text("⌘\(index + 1)").font(.caption).foregroundStyle(.secondary)
                        }.padding(.horizontal, 4).frame(maxWidth: .infinity)
                    }.controlSize(.large).disabled(selected.isEmpty).accessibilityLabel("设为" + status.rawValue)
                }
            }
        }.padding(.horizontal, 22).padding(.vertical, 12)
    }
}
