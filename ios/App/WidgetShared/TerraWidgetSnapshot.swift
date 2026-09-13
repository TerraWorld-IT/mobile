import Foundation

// 이 파일을 Xcode 에서 App 과 TerraWidgetExtension 두 타깃 멤버십에 모두 추가한다.
enum TerraWidgetSnapshot {
    static let groupID = "group.app.terraworld.mobile"
    static let kind = "TerraWidget"
    static let fileName = "terra-widget.png"

    static var fileURL: URL? {
        FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: groupID)?
            .appendingPathComponent(fileName)
    }
}
