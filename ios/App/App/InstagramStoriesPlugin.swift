import Capacitor
import UIKit

/// 인스타그램 스토리 직접 공유 (Meta "Sharing to Stories" iOS 계약).
///
/// Android 와 계약 동일 (isAvailable / shareSticker) — iOS 는 intent 대신
/// UIPasteboard(5분 만료) + `instagram-stories://share` 스킴을 사용한다.
/// Info.plist 의 LSApplicationQueriesSchemes 에 `instagram-stories` 선언 필수(canOpenURL).
/// 미설치/실패 시 opened=false — 웹 레이어가 시스템 공유 시트로 폴백한다.
/// ⚠️ 실기기 QA 필요: pasteboard/카메라 합성·앱 전환 복귀는 정적 검증 불가.
@objc(InstagramStoriesPlugin)
public class InstagramStoriesPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InstagramStoriesPlugin"
    public let jsName = "InstagramStories"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "shareSticker", returnType: CAPPluginReturnPromise)
    ]

    private static let storyScheme = "instagram-stories://share"

    @objc func isAvailable(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let url = URL(string: Self.storyScheme) else {
                call.resolve(["available": false])
                return
            }
            call.resolve(["available": UIApplication.shared.canOpenURL(url)])
        }
    }

    @objc func shareSticker(_ call: CAPPluginCall) {
        guard let stickerBase64 = call.getString("stickerBase64"), !stickerBase64.isEmpty else {
            call.reject("stickerBase64 is required")
            return
        }
        let sourceApplication = call.getString("sourceApplication") ?? ""
        let topColor = call.getString("topColor") ?? "#FFF8EB"
        let bottomColor = call.getString("bottomColor") ?? "#DFF3E8"

        // data URL prefix 허용 (canvas.toDataURL 출력 그대로 수신).
        let raw = stickerBase64.contains(",")
            ? String(stickerBase64.split(separator: ",", maxSplits: 1)[1])
            : stickerBase64
        guard let png = Data(base64Encoded: raw) else {
            call.reject("invalid base64 sticker")
            return
        }

        DispatchQueue.main.async {
            guard let url = URL(string: "\(Self.storyScheme)?source_application=\(sourceApplication)"),
                  UIApplication.shared.canOpenURL(url) else {
                call.resolve(["opened": false])
                return
            }
            let items: [[String: Any]] = [[
                "com.instagram.sharedSticker.stickerImage": png,
                "com.instagram.sharedSticker.backgroundTopColor": topColor,
                "com.instagram.sharedSticker.backgroundBottomColor": bottomColor
            ]]
            // Meta 계약: pasteboard 는 5분 만료로 설정.
            UIPasteboard.general.setItems(items, options: [
                .expirationDate: Date().addingTimeInterval(60 * 5)
            ])
            UIApplication.shared.open(url, options: [:]) { opened in
                call.resolve(["opened": opened])
            }
        }
    }
}
