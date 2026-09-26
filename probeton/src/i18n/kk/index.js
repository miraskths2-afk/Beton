// Казахский словарь: ключ — русская фраза как в коде, значение — перевод.
// Разбит на части по разделам сайта, чтобы было проще находить и
// править переводы. Если одна и та же фраза встречается в нескольких
// частях — берётся последняя.

import features from "./features";
import client from "./client";
import driver from "./driver";
import order from "./order";
import admin from "./admin";

export default {
  ...features,
  ...client,
  ...driver,
  ...order,
  ...admin,
};
