/**
 * CSS Modules Type Declarations
 * 
 * This file allows TypeScript to recognize CSS imports
 * as valid modules throughout the application.
 */

declare module '*.css' {
  const styles: { [key: string]: string };
  export default styles;
}

declare module '*.module.css' {
  const styles: { [key: string]: string };
  export default styles;
}

declare module '*.scss' {
  const styles: { [key: string]: string };
  export default styles;
}

declare module '*.module.scss' {
  const styles: { [key: string]: string };
  export default styles;
}

declare module '*.sass' {
  const styles: { [key: string]: string };
  export default styles;
}

declare module '*.module.sass' {
  const styles: { [key: string]: string };
  export default styles;
}
