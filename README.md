## Hi, I'm Nu11ified 👋

I build developer infrastructure, ML tooling and the occasional programming language. Lately: a home-grown source control and landing system, ROCm support for Candle, and GitForge, a Git LFS based GitHub alternative.

### Orochi commit map

Orochi is the Rust-based source control system that lands every commit on our monorepo's `main`. Nothing merges through GitHub's button anymore: a PR is proved, landed by Orochi as a squash commit, and only then mirrored back to GitHub.

```mermaid
flowchart LR
    PR["Pull request<br/>(reviewed, CI green)"] --> Gate{"Merge gate"}
    Gate -- "can wait" --> Batch["Batch rollup<br/>(every 20 min)"]
    Gate -- "urgent / protected path" --> Proof
    Batch --> Proof["Pre-land check<br/>(affected tests on the merged head)"]
    Proof -- "fails" --> Fix["Back to the author"]
    Proof -- "passes" --> Land["Orochi lands it<br/>squash commit + PR trailer"]
    Land --> Main[("main")]
    Main --> Mirror["Mirrored to GitHub<br/>PR closed with the landed sha"]
    Main --> Heal["Heal loop<br/>re-tests the tip, bisects a red"]
```

How the pieces fit:

```mermaid
flowchart LR
    GH["GitHub"] -- ingest --> Server["orochi-server<br/>objects + refs"]
    Server -- Fetch --> Cache["orochi-cache<br/>read-through cache"]
    Cache -- Fetch --> Daemon["orochi-daemon<br/>sparse checkout on each node"]
```

### Projects

| Project | What it is |
|---|---|
| [candle-rocm](https://github.com/Nu11ified/candle-rocm) | Experimental ROCm support for the Candle ML framework |
| GitForge | A Git LFS based GitHub alternative, with Go, Python and TypeScript SDKs |
| [polylab](https://github.com/Nu11ified/polylab) | Algorithm research assistant |
| [spbox](https://github.com/Nu11ified/spbox) | FiveM framework on SpacetimeDB, QBCore and Qbox compatible |
| [kiai-hub](https://github.com/Nu11ified/kiai-hub) | Kendo tournament management |
