/**
 * Growth Ops – Action Registry
 * Each action: { id, title, description, icon, type, target, requiresAdmin, featureFlag }
 *
 * type: 'link' | 'modal' | 'api' | 'tab'
 * target: URL path, modal id, or function path
 */
export const opsActions = [
  {
    id: 'temu-checklist',
    title: 'Temu Campaign: Launch Checklist',
    description: 'Pre-launch checklist for Temu affiliate campaign',
    icon: '🚀',
    type: 'modal',
    target: 'ops-modal-checklist',
    requiresAdmin: true,
    featureFlag: null
  },
  {
    id: 'presell-landing',
    title: 'Open Pre-sell Landing (/compare)',
    description: 'Open the comparison pre-sell page',
    icon: '🔗',
    type: 'link',
    target: '/compare.html',
    requiresAdmin: false,
    featureFlag: null
  },
  {
    id: 'pixel-status',
    title: 'Pixel / Events Status',
    description: 'TikTok Pixel + ClickTemu event health',
    icon: '📡',
    type: 'api',
    target: 'ops-health',
    requiresAdmin: true,
    featureFlag: null
  },
  {
    id: 'kpi-simulator',
    title: 'Run KPI Simulation',
    description: 'Simulate traffic, cost & revenue scenarios',
    icon: '📊',
    type: 'modal',
    target: 'ops-modal-simulator',
    requiresAdmin: true,
    featureFlag: null
  },
  {
    id: 'creative-pack',
    title: 'Creative Pack: RGB Strip',
    description: 'TikTok hooks, scripts & CTA angles',
    icon: '🎬',
    type: 'modal',
    target: 'ops-modal-creative',
    requiresAdmin: true,
    featureFlag: null
  },
  {
    id: 'landing-optimizer',
    title: 'Landing Optimizer Notes',
    description: 'CRO recommendations for max conversions',
    icon: '⚡',
    type: 'modal',
    target: 'ops-modal-optimizer',
    requiresAdmin: true,
    featureFlag: null
  },
  {
    id: 'campaign-engine',
    title: 'Campaign Engine',
    description: 'Open Campaign Composer tab',
    icon: '✉️',
    type: 'tab',
    target: 'campaigns',
    requiresAdmin: true,
    featureFlag: null
  },
  {
    id: 'academy',
    title: 'Academy',
    description: 'Open DropCharge Academy sub-app',
    icon: '🎓',
    type: 'link',
    target: '/academy/',
    requiresAdmin: true,
    featureFlag: 'ENABLE_ACADEMY'
  }
];
