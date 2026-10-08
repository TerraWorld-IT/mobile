import Capacitor
import Foundation
import ImageIO
import WidgetKit

// App 타깃 전용. ViewController.capacitorDidLoad에서 등록한다.
@objc(TerraWidgetPlugin)
public class TerraWidgetPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "TerraWidgetPlugin"
    public let jsName = "TerraWidget"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveSnapshot", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clearSnapshot", returnType: CAPPluginReturnPromise)
    ]
    private let writes = DispatchQueue(label: "app.terraworld.widget-snapshot")

    @objc func saveSnapshot(_ call: CAPPluginCall) {
        guard let value = call.getString("pngBase64"), value.count <= 1_000_000,
              value.hasPrefix("data:image/png;base64,"),
              let data = Data(base64Encoded: String(value.dropFirst(22))),
              data.starts(with: [137, 80, 78, 71, 13, 10, 26, 10]),
              let source = CGImageSourceCreateWithData(data as CFData, nil),
              let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
              (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.intValue == 320,
              (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.intValue == 442 else {
            call.reject("Widget PNG must be 320x442")
            return
        }
        writes.async {
            guard let url = TerraWidgetSnapshot.fileURL else {
                call.reject("Widget App Group is not configured")
                return
            }
            do {
                try data.write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
                var values = URLResourceValues()
                values.isExcludedFromBackup = true
                var storedURL = url
                try storedURL.setResourceValues(values)
                WidgetCenter.shared.reloadTimelines(ofKind: TerraWidgetSnapshot.kind)
                call.resolve()
            } catch {
                call.reject("Could not save widget snapshot")
            }
        }
    }

    @objc func clearSnapshot(_ call: CAPPluginCall) {
        writes.async {
            guard let url = TerraWidgetSnapshot.fileURL else {
                call.reject("Widget App Group is not configured")
                return
            }
            do {
                if FileManager.default.fileExists(atPath: url.path) {
                    try FileManager.default.removeItem(at: url)
                }
                WidgetCenter.shared.reloadTimelines(ofKind: TerraWidgetSnapshot.kind)
                call.resolve()
            } catch {
                call.reject("Could not clear widget snapshot")
            }
        }
    }
}
