# Asset provenance and licensing

Repository tooling uses the root code license. Third-party geometry and robot
parameters retain their own provenance and licensing status; the code license
must not be interpreted as a blanket license for every asset.

Each registered asset contains `asset.json` with source revision, actual file
hashes and license status, plus a `NOTICE.md` and any supplied license texts.
These records ship with the complete source archive. See the [inventory](docs/ASSET_INVENTORY.md).

Existing TacCap terms are recorded in the
[master notice](assets/grippers/xense/taccap/master-v2026.08.03/body/NOTICE.md) and
[slave notice](assets/grippers/xense/taccap/slave-v2026.08.03/NOTICE.md).
These assets follow the company's public `XTac-UMI-Description` release,
which supplies their MIT redistribution statement; the public license text
and original third-party notices are retained with each asset. The reviewed
upstream revision and synchronization procedure are documented in
[TacCap upstream tracking](docs/TACCAP_UPSTREAM.md).
Unconfirmed third-party permissions remain marked `unconfirmed`.

The separately versioned [TacCap 10.15 six-part model](assets/grippers/xense/taccap/slave-v2026.10.15/NOTICE.md)
uses user-provided STEP geometry and SW screenshots, with inherited frame
attribution retained separately. Redistribution permission for these new inputs
is unconfirmed; the public release license is not applied to them by inference.
