// Lets Node load Preact's unbuilt source, whose imports leave off ".js".
export async function resolve(spec, ctx, next) {
  try { return await next(spec, ctx) } catch (e) {
    if (spec.startsWith('.') && !/\.[mc]?js$/.test(spec)) {
      for (const ext of ['.js', '/index.js']) { try { return await next(spec + ext, ctx) } catch {} }
    }
    throw e
  }
}
