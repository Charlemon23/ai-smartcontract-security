# AI-Enhanced Smart Contract Security Testbed & Vulnerability Analyzer

Offline, multi-analyzer pipeline for automated vulnerability detection, benchmarking, and reproducible blockchain security research.

## ⚙️ Run Modes

```bash
npm run run:pipeline -- --tool=slither     # Static analysis
npm run run:pipeline -- --tool=mythril     # Symbolic execution
npm run run:pipeline -- --tool=oyente      # Execution-trace analysis
npm run run:pipeline -- --compare          # Run all & compare
