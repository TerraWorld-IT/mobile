import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {

    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        return true
    }

    func applicationWillResignActive(_ application: UIApplication) {
        // Sent when the application is about to move from active to inactive state. This can occur for certain types of temporary interruptions (such as an incoming phone call or SMS message) or when the user quits the application and it begins the transition to the background state.
        // Use this method to pause ongoing tasks, disable timers, and invalidate graphics rendering callbacks. Games should use this method to pause the game.
    }

    func applicationDidEnterBackground(_ application: UIApplication) {
        // Use this method to release shared resources, save user data, invalidate timers, and store enough application state information to restore your application to its current state in case it is terminated later.
        // If your application supports background execution, this method is called instead of applicationWillTerminate: when the user quits.
    }

    func applicationWillEnterForeground(_ application: UIApplication) {
        // Called as part of the transition from the background to the active state; here you can undo many of the changes made on entering the background.
    }

    func applicationDidBecomeActive(_ application: UIApplication) {
        // Restart any tasks that were paused (or not yet started) while the application was inactive. If the application was previously in the background, optionally refresh the user interface.
    }

    func applicationWillTerminate(_ application: UIApplication) {
        // Called when the application is about to terminate. Save data if appropriate. See also applicationDidEnterBackground:.
    }

    /// URL scheme allowlist (SEC-010): 임의 scheme/host 가 그대로 Capacitor 로
    /// 전달되지 않도록 검증.
    ///   - "terraworld"  : Info.plist CFBundleURLTypes 에 등록된 custom scheme
    ///   - "https"+host  : Universal Link (associated-domains entitlement)
    private static let allowedSchemes: Set<String> = ["terraworld", "https"]
    private static let allowedHosts: Set<String> = ["terraworld.app"]

    func application(_ app: UIApplication, open url: URL, options: [UIApplication.OpenURLOptionsKey: Any] = [:]) -> Bool {
        guard let scheme = url.scheme?.lowercased(), Self.allowedSchemes.contains(scheme) else {
            NSLog("AppDelegate: rejected url scheme=\(url.scheme ?? "nil")")
            return false
        }
        if scheme == "https" {
            guard let host = url.host?.lowercased(), Self.allowedHosts.contains(host) else {
                NSLog("AppDelegate: rejected https deeplink host=\(url.host ?? "nil")")
                return false
            }
        }
        return ApplicationDelegateProxy.shared.application(app, open: url, options: options)
    }

    func application(_ application: UIApplication, continue userActivity: NSUserActivity, restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void) -> Bool {
        // Universal Link 진입 — host allowlist 통과 시에만 Capacitor 로 위임.
        if userActivity.activityType == NSUserActivityTypeBrowsingWeb,
           let host = userActivity.webpageURL?.host?.lowercased(),
           !Self.allowedHosts.contains(host) {
            NSLog("AppDelegate: rejected universal link host=\(host)")
            return false
        }
        return ApplicationDelegateProxy.shared.application(application, continue: userActivity, restorationHandler: restorationHandler)
    }

}
