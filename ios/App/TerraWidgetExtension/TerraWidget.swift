import SwiftUI
import UIKit
import WidgetKit

struct TerraEntry: TimelineEntry {
    let date: Date
    let image: UIImage?
}

struct TerraProvider: TimelineProvider {
    func placeholder(in context: Context) -> TerraEntry {
        TerraEntry(date: Date(), image: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (TerraEntry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : currentEntry())
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<TerraEntry>) -> Void) {
        // 로컬 스냅샷만 갱신한다. 실제 스케줄링 예산은 WidgetKit 이 통제한다.
        completion(Timeline(entries: [currentEntry()], policy: .after(Date().addingTimeInterval(1800))))
    }

    private func currentEntry() -> TerraEntry {
        let image = TerraWidgetSnapshot.fileURL.flatMap { url -> UIImage? in
            guard let data = try? Data(contentsOf: url) else { return nil }
            return UIImage(data: data)
        }
        return TerraEntry(date: Date(), image: image)
    }
}

struct TerraWidgetView: View {
    let entry: TerraEntry
    private let background = Color(red: 1, green: 248.0 / 255, blue: 235.0 / 255)

    private var content: some View {
        Group {
            if let image = entry.image {
                Image(uiImage: image).resizable().scaledToFit().accessibilityLabel("나의 테라")
            } else {
                Text("앱에서 나의 테라를 열어 주세요")
                    .font(.caption).multilineTextAlignment(.center)
                    .foregroundStyle(Color(red: 73.0 / 255, green: 93.0 / 255, blue: 69.0 / 255))
                    .padding()
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .privacySensitive()
    }

    var body: some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) { background }
        } else {
            content.background(background)
        }
    }
}

@main
struct TerraWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: TerraWidgetSnapshot.kind, provider: TerraProvider()) { entry in
            TerraWidgetView(entry: entry)
        }
        .configurationDisplayName("나의 테라")
        .description("앱에서 마지막으로 본 테라리움을 보여줘요")
        .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
    }
}
