# Boo Privacy 👻

**Private Multi-Wallet Funding on Solana**

Fund many wallets privately using zero-knowledge proofs. Shield your funds, generate fresh wallets, and distribute SOL anonymously.

> Built for the [Solana Privacy Hackathon 2025](https://solana.com/privacyhack)

## Features

- **🔐 ZK Privacy** - Shield your funds using zero-knowledge proofs powered by Privacy Cash
- **👻 Multi-Wallet Generation** - Create unlimited HD wallets from a single seed phrase
- **💸 Batch Private Funding** - Fund many wallets in one flow, breaking the link between source and destinations
- **⚡ Simple UX** - Connect, shield, generate, fund. No complicated setup.
- **🔒 Non-Custodial** - Your seed phrase never leaves your browser

## How It Works

1. **Connect Wallet** - Sign in with email or connect an external Solana wallet via Privy
2. **Deposit SOL** - Send SOL to your embedded wallet address
3. **Shield Funds** - Use Privacy Cash ZK proofs to shield your funds
4. **Generate Wallets** - Create fresh HD wallets from a new seed phrase (saved locally only)
5. **Fund Privately** - Distribute shielded SOL to all generated wallets

## Tech Stack

- **Frontend**: Next.js 14, React, Tailwind CSS, TypeScript
- **Auth & Wallets**: Privy (embedded Solana wallets)
- **Privacy Layer**: Privacy Cash SDK (ZK proofs)
- **HD Wallets**: BIP39 + ed25519-hd-key (client-side only)
- **State**: Zustand

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn
- Privy App ID (get one at [console.privy.io](https://console.privy.io))

### Installation

```bash
# Clone the repo
git clone https://github.com/JussCubs/boo-privacy.git
cd boo-privacy

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Add your Privy App ID and RPC URL to .env.local
```

### Environment Variables

```env
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id
NEXT_PUBLIC_SOLANA_SECURE_RPC_URL=your_rpc_url
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Production Build

```bash
npm run build
npm start
```

## Security

- **Non-custodial**: We never have access to your funds or keys
- **Local-only seed phrases**: Generated seed phrases are never sent to any server
- **ZK proofs**: Privacy is ensured through cryptographic zero-knowledge proofs
- **Open source**: All code is auditable

### Disclaimer

This software is provided as-is. Always verify transactions and keep your seed phrases secure. Not financial advice.

## Hackathon Tracks

Boo Privacy is submitted to the following Solana Privacy Hackathon tracks:

- **Private Payments** - Enables confidential transfers to multiple wallets
- **Privacy Tooling** - Provides infrastructure for private multi-wallet funding

## Links

- **Website**: [booprivacy.com](https://booprivacy.com)
- **Twitter**: [@booprivacy](https://twitter.com/booprivacy)
- **GitHub**: [JussCubs/boo-privacy](https://github.com/JussCubs/boo-privacy)

## Powered By

- [Privacy Cash](https://privacycash.org) - ZK privacy layer
- [Privy](https://privy.io) - Embedded wallets
- [Solana](https://solana.com) - Fast blockchain

## License

MIT License - see [LICENSE](LICENSE)

---

Built with 👻 for the Solana Privacy Hackathon 2025
