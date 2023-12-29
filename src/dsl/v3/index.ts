import { NuggetBuilder } from "./nugget-builder";
import { Context, DippedNugget, Nugget } from "./types";

export * from "./types";

export const SIGN_IN = new NuggetBuilder("sign_in")
  .whenAtPath("/")
  .whenStateIncludes("email", "password")
  .then(({ page, state: { email, password } }) =>
    page.setValues({ email, password })
  );

export async function dipNuggets<T>(
  nuggets: Nugget<T>[],
  context: Context<unknown>
): Promise<DippedNugget<T>[]> {
  return nuggets.reduce<Promise<DippedNugget<T>[]>>(
    (promise, nugget) =>
      promise.then(async (list) => {
        const apply = await nugget.dip(context);
        if (apply) {
          list.push({
            name: nugget.name,
            apply,
          });
        }
        return list;
      }),
    Promise.resolve([])
  );
}
