import {
    getRefreshTokenDurationMs,
  } from "./tokenDuration.js";
  
  const REFRESH_COOKIE_NAME = "refreshToken";
  
  const getRefreshCookieOptions = () => {
    const isProduction =
      process.env.NODE_ENV === "production";
  
    return {
      httpOnly: true,
      secure: isProduction,
  
      // Use "none" when the frontend and backend are
      // hosted on different HTTPS sites.
      sameSite: isProduction
        ? "none"
        : "lax",
  
      path: "/api/v1/auth",
  
      maxAge: getRefreshTokenDurationMs(),
    };
  };
  
  export const setRefreshTokenCookie = (
    res,
    refreshToken
  ) => {
    res.cookie(
      REFRESH_COOKIE_NAME,
      refreshToken,
      getRefreshCookieOptions()
    );
  };
  
  export const clearRefreshTokenCookie = (
    res
  ) => {
    const options =
      getRefreshCookieOptions();
  
    res.clearCookie(
      REFRESH_COOKIE_NAME,
      {
        httpOnly: options.httpOnly,
        secure: options.secure,
        sameSite: options.sameSite,
        path: options.path,
      }
    );
  };
  
  export const getRefreshTokenFromRequest = (
    req
  ) => {
    return req.cookies?.[
      REFRESH_COOKIE_NAME
    ];
  };