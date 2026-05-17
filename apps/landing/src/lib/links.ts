export const API_URL =
	process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export const DASHBOARD_URL =
	process.env.NEXT_PUBLIC_DASHBOARD_URL ?? "http://localhost:3000";

export const WORKSPACE_SLUG =
	process.env.NEXT_PUBLIC_WORKSPACE_SLUG ?? "demo";

export const signupUrl = `${DASHBOARD_URL}/register`;
export const loginUrl = `${DASHBOARD_URL}/login`;
export const widgetDemoUrl = `${API_URL}/widget-demo/demo.html`;
