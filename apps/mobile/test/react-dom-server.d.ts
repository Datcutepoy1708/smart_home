declare module "react-dom/server" {
  export function renderToStaticMarkup(node: import("react").ReactNode): string;
}
