export interface MenuItem {
  name: string;
  href: string;
  target?: string;
  children?: MenuItem[];
}

export interface SiteConfig {
  navItems: MenuItem[];
  buyLink: string;
}

export const siteConfig: SiteConfig = {
  navItems: [
    {
      name: 'Cross Chain Mixer',
      href: '/eth-sol',
      children: [
        { name: 'ETH-ETH', href: '/eth-eth' },
        { name: 'ETH-SOL', href: '/eth-sol' },
        { name: 'SOL-SOL', href: '/sol-sol' },
        { name: 'SOL-ETH', href: '/sol-eth' },
      ],
    },
    { name: 'Bridge', href: 'https://bridge.aintivirus.ai', target: '_blank' },
    { name: 'Gift Card / E Sim', href: 'https://aintivirus.ai/esim', target: '_blank' },
    { name: 'Merch', href: 'https://aintivirus.ai/merch', target: '_blank' },
    {
      name: 'Media',
      href: 'https://aintivirus.ai/media',
      target: '_blank',
      children: [
        { name: 'Digital Freedom', href: 'https://aintivirus.ai/digital-freedom', target: '_blank' },
        { name: 'Blog', href: 'https://aintivirus.ai/blog', target: '_blank' },
        { name: 'Privacy', href: 'https://aintivirus.ai/privacy', target: '_blank' },
        { name: 'Podcast', href: 'https://aintivirus.ai/podcast', target: '_blank' },
        { name: 'RWS Season 1', href: 'https://aintivirus.ai/rws-series', target: '_blank' },
      ],
    },
    {
      name: 'NFT',
      href: 'https://aintivirus.ai/macfee-archive',
      target: '_blank',
      children: [
        { name: 'Archived Video', href: 'https://aintivirus.ai/videos', target: '_blank' },
        { name: 'Archived Ebook', href: 'https://aintivirus.ai/ebooks', target: '_blank' },
        { name: 'McAfee Mixology', href: 'https://aintivirus.ai/mixology', target: '_blank' },
      ],
    },
  ],
  buyLink:
    'https://raydium.io/swap/?inputMint=BAezfVmia8UYLt4rst6PCU4dvL2i2qHzqn4wGhytpNJW&outputMint=sol',
};


