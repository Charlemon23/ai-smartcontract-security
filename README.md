# AI-Enhanced Smart Contract Security Testbed & Vulnerability Analyzer

> Offline-first, reproducible static analysis for Solidity smart contracts with autonomous reporting.  
> Built to remain fully functional even during cloud outages (e.g., the October 2025 AWS incident).

## Why this exists

Many blockchain auditing pipelines silently depend on centralized cloud services. When the October 2025 AWS outage disrupted dashboards and CI pipelines, analyses stalled.  
This testbed is designed for **resilience**: it runs **entirely offline** and produces **deterministic** outputs suitable for research replication and classroom demonstration.

## Architecture

- **Dataset seeding (offline):** known Solidity contracts are stored under `data/contracts/offline_seed`.
- **Analyzer engine:** invokes Slither via `python3 -m slither` to avoid PATH/venv issues.
- ## Multi-Analyzer Support

You can now select which analyzer to run:
```bash
npm run run:pipeline -- --tool=slither
npm run run:pipeline -- --tool=mythril
npm run run:pipeline -- --tool=oyente
npm run run:pipeline -- --compare

- **Reports:** machine-readable JSON under `data/reports/`.
- **Summaries:** readable `summary_readable.txt` produced every run.
