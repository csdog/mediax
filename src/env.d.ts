/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_LOG_CONSOLE_LEVEL?: string;
  readonly MAIN_VITE_LOG_FILE_LEVEL?: string;
  readonly MAIN_VITE_LOG_MAX_SIZE?: string;
  readonly MAIN_VITE_DEV_SERVER_PORT?: string;
}
