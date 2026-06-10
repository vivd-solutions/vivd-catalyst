import type { ChatShellAdminPanel } from "./chat-shell";
import { canViewSuperadminPanel } from "./governance";
import { SuperadminPanel } from "./superadmin-panel";

export { canViewSuperadminPanel } from "./governance";
export { SuperadminPanel } from "./superadmin-panel";

export const superadminPanel: ChatShellAdminPanel = {
  canView: canViewSuperadminPanel,
  renderPanel: (props) => <SuperadminPanel {...props} />
};
