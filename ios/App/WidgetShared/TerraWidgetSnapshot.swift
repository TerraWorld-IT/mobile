import Foundation

// App과 TerraWidgetExtension 양쪽 타깃이 같은 App Group 파일을 사용한다.
enum TerraWidgetSnapshot {
    static let groupID = "group.app.terraworld.mobile"
    static let kind = "TerraWidget"
    static let fileName = "terra-widget.png"

    static var fileURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
            .appendingPathComponent(fileName)
    }
}
