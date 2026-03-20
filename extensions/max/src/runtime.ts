/**
 * Max channel runtime store.
 *
 * Inlined version of createPluginRuntimeStore to avoid jiti alias issues
 * when extensions are loaded at runtime.
 */

let _runtime: any = null;

export function setMaxRuntime(runtime: any): void {
  _runtime = runtime;
}

export function getMaxRuntime(): any {
  if (!_runtime) {
    throw new Error("Max runtime not initialized — plugin not registered yet");
  }
  return _runtime;
}

export function tryGetMaxRuntime(): any | null {
  return _runtime;
}
