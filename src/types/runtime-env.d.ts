declare namespace NodeJS {
  interface ProcessEnv {
    /** Private server runtime URL for the optional updates signup. */
    MAILWERK_URL?: string;
    /** Glassy UI project runtime key; never expose through NEXT_PUBLIC_*. */
    MAILWERK_API_KEY?: string;
  }
}
