export interface MenuItem {
  name: string;
  href: string;
  target?: string;
  children?: MenuItem[];
}

export interface SiteConfig {
  navItems: MenuItem[];
  footerItems: MenuItem[];
  buyLink: string;
}

export const siteConfig: SiteConfig = {
  navItems: [
    {
      name: 'Cross Chain Mixer',
      href: 'https://mix.aintivirus.ai',
      target: '_blank',
      children: [
        { name: 'ETH-ETH', href: 'https://mix.aintivirus.ai/eth-eth', target: '_blank' },
        { name: 'ETH-SOL', href: 'https://mix.aintivirus.ai/eth-sol', target: '_blank' },
        { name: 'SOL-SOL', href: 'https://mix.aintivirus.ai/sol-sol', target: '_blank' },
        { name: 'SOL-ETH', href: 'https://mix.aintivirus.ai/sol-eth', target: '_blank' },
      ],
    },
    { name: 'Bridge', href: 'https://bridge.aintivirus.ai/', target: '_blank' },
    {
      name: 'Gift Card / E Sim',
      href: 'https://aintivirus.ai/giftcard',
      target: '_blank',
      children: [
        { name: 'Gift Card', href: 'https://aintivirus.ai/giftcard', target: '_blank' },
        { name: 'ESIM', href: 'https://aintivirus.ai/esim', target: '_blank' },
        { name: 'My Orders', href: 'https://aintivirus.ai/track', target: '_blank' },
      ],
    },
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
        { name: 'Running With Scissors', href: 'https://aintivirus.ai/rws-series', target: '_blank' },
        { name: 'Digital Underworld', href: 'https://aintivirus.ai/du-series', target: '_blank' },
        { name: 'Archived Video', href: 'https://aintivirus.ai/videos', target: '_blank' },
        { name: 'Archived Ebook', href: 'https://aintivirus.ai/ebooks', target: '_blank' },
        { name: 'McAfee Mixology', href: 'https://aintivirus.ai/mixology', target: '_blank' },
      ],
    },
    {
      name: 'Tools',
      href: 'https://aintivirus.ai/tools',
      target: '_blank',
      children: [
        { name: 'AINTI Dashboard', href: 'https://aintivirus.ai/dashboard', target: '_blank' },
        { name: 'Surveillance Tracker', href: 'https://tracker.aintivirus.ai/', target: '_blank' },
        { name: 'Metadata Cleaner', href: 'https://aintivirus.ai/exifkiller', target: '_blank' },
        { name: 'McAfee Dex', href: 'https://dex.aintivirus.ai', target: '_blank' },
        { name: 'AINTI DAO', href: 'https://v2.realms.today/dao/BFrzycbMGUuNdFiHRAEgiLzhKwrtFLSd2dfquWURC6Nz', target: '_blank' },
      ],
    },
    { name: 'Dashboard', href: 'https://aintivirus.ai/dashboard', target: '_blank' },
  ],
  footerItems: [
    { name: 'Cross Chain Mixer', href: 'https://mix.aintivirus.ai', target: '_blank' },
    { name: 'Bridge', href: 'https://bridge.aintivirus.ai/', target: '_blank' },
    { name: 'Gift Card / E Sim', href: 'https://aintivirus.ai/giftcard', target: '_blank' },
    { name: 'Merch', href: 'https://aintivirus.ai/merch', target: '_blank' },
    { name: 'Media', href: 'https://aintivirus.ai/media', target: '_blank' },
  ],
  footerItems: [
    { name: 'Cross Chain Mixer', href: 'https://mix.aintivirus.ai', target: '_blank' },
    { name: 'Bridge', href: 'https://bridge.aintivirus.ai/', target: '_blank' },
    { name: 'Gift Card / E Sim', href: 'https://aintivirus.ai/giftcard', target: '_blank' },
    { name: 'Merch', href: 'https://aintivirus.ai/merch', target: '_blank' },
    { name: 'Media', href: 'https://aintivirus.ai/media', target: '_blank' },
  ],
  buyLink:
    'https://raydium.io/swap/?inputMint=BAezfVmia8UYLt4rst6PCU4dvL2i2qHzqn4wGhytpNJW&outputMint=sol',
};


