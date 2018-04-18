

exports.down = function(knex, Promise) {
  return Promise.all([
    knex.schema.dropTable('tweets'),
  ]);
};
