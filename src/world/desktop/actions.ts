// The app actions the desktop handles, beside the shell's (dock). Each app module adds its own.
import type { ActionHandler } from "./controller";
import { messageActions } from "./messages/actions";

export const desktopActions: Record<string, ActionHandler> = {
  ...messageActions,
};
