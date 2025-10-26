import { Redirect } from "expo-router";

export default function Index() {
  // Simple, no side effects: redirects on first render
  return <Redirect href="/login" />;
}
