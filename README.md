# Compromised content process can flip persistent security preferences via

# forged NetError actor messages

**Component**: Core → DOM: Navigation / Networking (neterror page actors)
**Tested on**: mozilla-firefox/firefox @ main (2026-09-05 snapshot); verified live on
Firefox 155.0.1 Windows release build
**Threat model**: attacker-controlled content process

## Summary

The `NetError` JSWindowActor pair (child: `toolkit/actors/NetErrorChild.sys.mjs`,
parent: `toolkit/actors/NetErrorParent.sys.mjs`) lets the neterror page request
privileged recovery actions from the parent. The parent-side `receiveMessage`
(NetErrorParent.sys.mjs:544) performs no sender validation — no principal check, no
verification that the sender document is a neterror page, no user gesture
requirement. An attacker controlling a content process therefore controls the child
side completely and can invoke every handler at will, including handlers that
persistently modify parent-process security preferences.

## Reproduction (verified end-to-end on the release build)

Prerequisite: a tab showing the neterror page — navigating to a non-resolving host
such as `http://poc-invalid-8zq3.invalid/` produces
`about:neterror?e=dnsNotFound`, and the attacker fully controls when this happens.

From chrome-privileged code inside the content process:

```js
const wgc = content.windowGlobalChild;
const actor = wgc.getActor("NetError");
actor.sendAsyncMessage("Browser:ResetSSLPreferences");
actor.sendAsyncMessage("Browser:ResetEnterpriseRootsPref");
actor.sendAsyncMessage("Browser:AddTRRExcludedDomain");
```

Observed over multiple runs on Firefox 155.0.1 release (Windows):

* user prefs `security.tls.version.enable-tls1_3` and
  `security.enterprise_roots.enabled` that were explicitly set before the run were
  cleared (`prefHasUserValue()` flipped true → false) and persisted to the profile;
* `network.trr.excluded-domains` gained dozens of appended `poc-invalid-8zq3.invalid`
  entries (one per forged message) — a persistent DoH bypass for a domain chosen by
  navigating the attacker's own tab first;
* no dialog, no prompt, no notification of any kind.

## Impact

1. `Browser:ResetSSLPreferences` clears every user pref under
   `security.tls.version.*`, `security.ssl3.*` and `security.tls13.*`
   (PREF_SSL_IMPACT_ROOTS, NetErrorParent.sys.mjs:11-15; handler at :565-576). A
   user's TLS hardening — for example TLS 1.0/1.1 disabled — is silently re-enabled
   and persisted, enabling protocol downgrade against legacy servers when combined
   with an on-path attacker. The change survives browser restarts.
2. `Browser:ResetEnterpriseRootsPref` clears `security.enterprise_roots.enabled` and
   `auto-enabled` (:569-572), disabling OS trust store integration.
3. `Browser:AddTRRExcludedDomain` appends the browsing context's host to
   `network.trr.excluded-domains` (:610-623). The host is attacker-chosen, since the
   compromised process can navigate its own tab to the target domain first — chosen
   domains permanently stop using DoH.
4. `SearchCTA:Search` runs a search with a system-principal trigger and
   attacker-controlled query text (:528-534).
5. `Browser:CertExceptionError` opens `about:certificate?cert=…` with
   attacker-supplied certificate payloads (:585-600).

All of this requires no user interaction beyond an error page the attacker can
trigger at will.

## Why this is a bug and not a design choice

The same file validates where the author remembered to: `displayOfflineSupportPage`
whitelists its slug (`AVAILABLE_PAGES`, NetErrorParent.sys.mjs:210-216). The
pref-mutating handlers received no equivalent treatment. The actor's `matches`
(`about:certerror?*`, `about:neterror?*`) scopes where the *child* is constructed,
but the parent never verifies that the *sender* is that page — and in the
compromised-process model the child side is attacker code.

## Suggested fix

Validate in `receiveMessage` that the sender document is the neterror page (compare
the WindowGlobal's document URI against the actor's matches), or require a user
gesture plus confirmation for the preference-mutating handlers.


## Source URLs

* `toolkit/actors/NetErrorParent.sys.mjs`
  * GitHub: https://github.com/mozilla-firefox/firefox/blob/main/toolkit/actors/NetErrorParent.sys.mjs
  * Searchfox: https://searchfox.org/firefox-main/source/toolkit/actors/NetErrorParent.sys.mjs
  * line 11: PREF_SSL_IMPACT_ROOTS
    * GitHub: https://github.com/mozilla-firefox/firefox/blob/main/toolkit/actors/NetErrorParent.sys.mjs#L11
    * Searchfox: https://searchfox.org/firefox-main/source/toolkit/actors/NetErrorParent.sys.mjs#L11
  * line 210: displayOfflineSupportPage slug whitelist (validation contrast)
    * GitHub: https://github.com/mozilla-firefox/firefox/blob/main/toolkit/actors/NetErrorParent.sys.mjs#L210
    * Searchfox: https://searchfox.org/firefox-main/source/toolkit/actors/NetErrorParent.sys.mjs#L210
  * line 544: receiveMessage - no sender validation
    * GitHub: https://github.com/mozilla-firefox/firefox/blob/main/toolkit/actors/NetErrorParent.sys.mjs#L544
    * Searchfox: https://searchfox.org/firefox-main/source/toolkit/actors/NetErrorParent.sys.mjs#L544
  * line 565: Browser:ResetSSLPreferences handler
    * GitHub: https://github.com/mozilla-firefox/firefox/blob/main/toolkit/actors/NetErrorParent.sys.mjs#L565
    * Searchfox: https://searchfox.org/firefox-main/source/toolkit/actors/NetErrorParent.sys.mjs#L565
  * line 610: Browser:AddTRRExcludedDomain handler
    * GitHub: https://github.com/mozilla-firefox/firefox/blob/main/toolkit/actors/NetErrorParent.sys.mjs#L610
    * Searchfox: https://searchfox.org/firefox-main/source/toolkit/actors/NetErrorParent.sys.mjs#L610
* `toolkit/actors/NetErrorChild.sys.mjs`
  * GitHub: https://github.com/mozilla-firefox/firefox/blob/main/toolkit/actors/NetErrorChild.sys.mjs
  * Searchfox: https://searchfox.org/firefox-main/source/toolkit/actors/NetErrorChild.sys.mjs
