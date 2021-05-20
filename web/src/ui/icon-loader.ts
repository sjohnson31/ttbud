// Can't test this because it relies on webpack features not supported in jest :(
/* istanbul ignore file */

export const loadIcons = () => {
  const context = (require as NodeRequire).context("../icon", true, /.*\.svg/);
  return context.keys().map((path) => {
    return {
      path: path,
      img: context(path).default,
    };
  });
};
