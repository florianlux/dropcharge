/**
 * widget-registry.js – Central list of dashboard widgets.
 * Import each widget module and register it here.
 */

import { kpiQuickWidget } from './widgets/kpi-quick.js';
import { latestSignupsWidget } from './widgets/latest-signups.js';
import { funnelWidget } from './widgets/funnel.js';
import { topDealsWidget } from './widgets/top-deals.js';
import { topReferrersWidget } from './widgets/top-referrers.js';
import { outboundClicksWidget } from './widgets/outbound-clicks.js';
import { signupTrendWidget } from './widgets/signup-trend.js';

/** All available widgets in display order */
export const widgetList = [
  kpiQuickWidget,
  funnelWidget,
  signupTrendWidget,
  latestSignupsWidget,
  topDealsWidget,
  topReferrersWidget,
  outboundClicksWidget
];
