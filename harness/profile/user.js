// poc.candidates: which demonstration this bundle runs
user_pref("poc.candidates", "neterror");
user_pref("browser.dom.window.dump.enabled", true);
user_pref("browser.startup.page", 0);
user_pref("browser.aboutwelcome.enabled", false);
user_pref("datareporting.policy.dataSubmissionPolicyBypassNotification", true);
user_pref("messaging-system.rsexperimentloader.enabled", false);
user_pref("app.update.auto", false);
user_pref("browser.shell.checkDefaultBrowser", false);
// pre-planted user prefs that the forged messages clear
user_pref("security.tls.version.enable-tls1_3", false);
user_pref("security.enterprise_roots.enabled", false);
user_pref("network.trr.excluded-domains", "poc-base.invalid");
