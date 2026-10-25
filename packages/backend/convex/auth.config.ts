export default {
  providers: [
    {
      domain:
        process.env.CUSTOM_AUTH_SITE_URL ||
        process.env.CONVEX_SITE_URL ||
        "http://127.0.0.1:3211",
      applicationID: "convex",
    },
  ],
};
