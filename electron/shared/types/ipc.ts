export interface IpcResponse<T> {
  ok: boolean;
  data: T;
  error?: string;
}
