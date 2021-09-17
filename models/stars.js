const db = require("../config/db");

class Stars {
  static findAll() {
    let sql = `SELECT * FROM stars`;
    db.execute(sql, function (err, result) {
      if (err) throw err;
      console.log(result);
    });
  }

  static controlAndSaveItem(itemList) {
    //itemlist elimizde bulunan locallist
    try {
      itemList.forEach((item) => {
        let sql_find = `SELECT * FROM stars WHERE symbol = '${item.symbol}' AND DATE(date) = CURDATE()`;

        db.execute(sql_find, function (err, result) {
          if (err) throw err;
          if (result.length > 0) {
            console.log("bu coin zaten db de var", item.symbol);
          } else {
            let sql_insert = `INSERT INTO stars (symbol, date, 1h_volume, 24h_volume) VALUES ('${item.symbol}', NOW(), '${item.last_1h}', '${item.last_24h}')`;
            db.query(sql_insert);
          }
        });
      });
    } catch (error) {
      console.log(error);
    }
  }

  static controlAndRemoveItem(itemList) {
    //bu item artık mesaj listemizde yok bu yüzden günlük veriler incelenip içerisinden silinmeli
    //Bugüne ait olan coinler db den alınır, gelen liste ile karşılaştırılır ve eşleşmezse silinir. Bu coin zaten db de var ise güncellenir.
    try {
      let sql_find = `SELECT * FROM stars WHERE DATE(date) = CURDATE()`;
      db.execute(sql_find, function (err, result) {
        if (err) throw err;
        if (result.length > 0) {
          result.forEach((dbItem) => {
            let find = itemList.some((item) => item.symbol == dbItem.symbol);
            if (!find) {
              console.log("delete", dbItem.symbol);
              let sql_delete = `DELETE FROM stars WHERE symbol = '${dbItem.symbol}' AND DATE(date) = CURDATE()`;
              db.query(sql_delete);
            } else {
              console.log("update", dbItem.symbol);
              let item = itemList.find((item) => item.symbol == dbItem.symbol);
              let sql_update = `UPDATE stars SET 1h_volume = '${item.last_1h}' , date = NOW(), 24h_volume = '${item.last_24h}' WHERE symbol = '${item.symbol}'  AND DATE(date) = CURDATE()`;
              db.query(sql_update);
            }
          });
        }
      });
    } catch (error) {
      console.log(error);
    }
  }
}

module.exports = Stars;
