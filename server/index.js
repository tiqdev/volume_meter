const express = require("express");
const app = express();
const fetch = require("node-fetch");
const server = require("http").createServer(app);
const WebSocket = require("ws");
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const Stars = require("../models/stars");
require("dotenv").config();

const token = "1987302854:AAHmAkQOXjFo3M3N6EPcr5OeCS2tVkdrIyQ";
const bot = new TelegramBot(token, { polling: true });
let chatId = -1001581737315;

var coinPrevList = [];
var coinLiveList = [];
var sorted_15m_30m_45m_60m = {};

internationalNumberFormat = new Intl.NumberFormat("en-US", {
  maximumSignificantDigits: 9,
});

server.listen(4000, () => {
  console.log("Server is running on port 4000");
});

const io = require("socket.io")(server, {
  cors: {
    origin: "*",
  },
});

getPrevCoinList();
getLiveCoinList();
get15mCandleList();

io.on("connection", (socket) => {
  console.log("New client connected");
  socket.on("disconnect", () => {});

  setInterval(() => {
    socket.emit("getPrevCoinList", coinPrevList);
    socket.emit("getLiveCoinList", coinLiveList);
    socket.emit("get15mCandleList", sorted_15m_30m_45m_60m);
  }, 2000);
});

//Socket ile dinlendiğinde sürekli bir veri göstermemiz gerekecek fakat bu veriyi her sn işlememize gerek yok bu yüzden buradaki
//interval ı kendimiz ayarlayıp o zamana kadar bir istek olursa elimizde tuttugumuz eski listeyi vermiş oluruz.
setInterval(() => {
  let date = new Date();
  let hour = date.getHours();
  let minutes = date.getMinutes();
  if (minutes == 0) {
    getPrevCoinList();
  } else if (minutes == 2) {
    sendStarMessage();
    //saveToDb();
  }
  if (hour == 3 && minutes == 1) {
    //clear 15m_1_coins.json
    clearFile("./files/15m_1_coins.json");
    console.log("File cleared");
  }
}, 60000);

//her dakika veriyi güncelleyip socket ile gönderiyoruz.
setInterval(() => {
  get15mCandleList();
  saveToDb();
}, 60000);

function getPrevCoinList() {
  usdtCoins = [];
  sorted48h_24h = [];
  fetch("https://api.binance.com/api/v3/ticker/24hr")
    .then((response) => response.json())
    .then((data) => {
      //var data = JSON.parse(data);

      try {
        data = data.filter(
          (coin) =>
            coin.symbol.endsWith("USDT") && coin.quoteVolume >= 100000000
        );

        data.sort(function (a, b) {
          return b.q - a.q;
        });
      } catch (e) {
        console.log(e);
      }

      data.forEach((element) => {
        try {
          if (
            element.symbol != "BUSDUSDT" &&
            element.symbol != "USDCUSDT" &&
            element.symbol != "EURUSDT" &&
            element.symbol != "TUSDUSDT" &&
            element.symbol != "SUSDUSDT"
          ) {
            fetch(
              "https://api.binance.com/api/v3/klines?symbol=" +
                element.symbol +
                "&interval=1h&limit=49"
            )
              .then((response) => response.json())
              .then((data) => {
                let coin = {
                  symbol: "",
                  last_1h: 0,
                  last_2h_1h: 0,
                  last_24h: 0,
                  last_48h_24h: 0,
                  last_48h: 0,
                  open_1h: 0,
                  close_1h: 0,
                  open_24h: 0,
                  close_24h: 0,
                  open_48h: 0,
                  close_48h: 0,
                  formatted_last_1h: "",
                  formatted_last_2h_1h: "",
                  formatted_last_24h: "",
                  formatted_last_48h_24h: "",
                  formatted_last_48h: "",
                  percentage1h: 0,
                  percentage24h: 0,
                  color_24h: "",
                  status_24h_icon: "",
                  percentage_1h_color: "",
                  percentage_24h_color: "",
                };

                coin.symbol = element.symbol.replace("USDT", "");

                let last_1h = parseFloat(data[data.length - 2][7]);
                let last_2h_1h = parseFloat(data[data.length - 3][7]);

                let last_24h = 0;
                let last_48h_24h = 0;
                let last_48h = 0;

                if (data.length >= 2) {
                  for (i = 2; i <= 25; i++) {
                    last_24h += parseFloat(
                      data[data.length - i] == undefined
                        ? 0
                        : data[data.length - i][7]
                    );
                  }

                  for (i = 26; i <= 49; i++) {
                    last_48h_24h += parseFloat(
                      data[data.length - i] == undefined
                        ? 0
                        : data[data.length - i][7]
                    );
                  }

                  for (i = 2; i <= 49; i++) {
                    last_48h += parseFloat(
                      data[data.length - i] == undefined
                        ? 0
                        : data[data.length - i][7]
                    );
                  }

                  try {
                    coin.open_24h = parseFloat(data[data.length - 25][1]);
                    coin.close_24h = parseFloat(data[data.length - 2][4]);
                  } catch (err) {
                    coin.open_24h = 0;
                    coin.close_24h = 0;
                  }
                }

                coin.last_1h = last_1h;
                coin.last_2h_1h = last_2h_1h;

                coin.last_24h = last_24h;
                coin.last_48h_24h = last_48h_24h;
                coin.last_48h = last_48h;

                usdtCoins.push(coin);
                sorted48h_24h.push(coin);
              })
              .then(() => {
                usdtCoins.sort(function (a, b) {
                  return b.last_24h - a.last_24h;
                });

                sorted48h_24h.sort(function (a, b) {
                  return b.last_48h_24h - a.last_48h_24h;
                });

                usdtCoins.forEach((data) => {
                  let formatted_last_1h = internationalNumberFormat.format(
                    data["last_1h"].toFixed(0).slice(0, -6)
                  );
                  let formatted_last_24h = internationalNumberFormat.format(
                    data["last_24h"].toFixed(0).slice(0, -6)
                  );
                  let formatted_last_48h = internationalNumberFormat.format(
                    data["last_48h"].toFixed(0).slice(0, -6)
                  );
                  let formatted_last_48h_24h = internationalNumberFormat.format(
                    data["last_48h_24h"].toFixed(0).slice(0, -6)
                  );

                  data.formatted_last_1h = formatted_last_1h;
                  data.formatted_last_24h = formatted_last_24h;
                  data.formatted_last_48h = formatted_last_48h;
                  data.formatted_last_48h_24h = formatted_last_48h_24h;

                  let last_1h_int = data["last_1h"];
                  let last_2h_1h_int = data["last_2h_1h"];
                  let last_24h_int = data["last_24h"];
                  let last_48h_int = data["last_48h"];
                  let last_48h_24h_int = data["last_48h_24h"];

                  var id_24h = findId(usdtCoins, data["symbol"]);
                  var id_48h_24h = findId(sorted48h_24h, data["symbol"]);
                  let percentage1h = 0;
                  let percentage24h = 0;
                  let color_24h = "";
                  let status_24h_icon = "";
                  let percentage_24h_color = "";
                  let percentage_1h_color = "";

                  let subs48_24 = 0;

                  if (last_2h_1h_int != 0 && last_1h_int != 0) {
                    percentage1h = parseInt(
                      ((last_1h_int - last_2h_1h_int) / last_2h_1h_int) * 100
                    );
                    if (percentage1h > 0) {
                      percentage_1h_color = "color:#5bd7b9 !important";
                    } else if (percentage1h < 0) {
                      percentage_1h_color = "color:#e44f5c !important";
                    } else if (percentage1h == 0) {
                      percentage_1h_color = "color:#f1f1f1 !important";
                    }
                  } else {
                    percentage1h = "NEW";
                    percentage_1h_color = "color:#a185f2 !important";
                  }

                  data.percentage1h = percentage1h;
                  data.percentage_1h_color = percentage_1h_color;

                  if (last_48h_24h_int != 0 && last_48h_int != 0) {
                    percentage24h = parseInt(
                      ((last_24h_int - last_48h_24h_int) / last_48h_24h_int) *
                        100
                    );
                    subs48_24 = last_48h_int - last_24h_int;
                    subs48_24 = parseInt(subs48_24.toFixed(0).slice(0, -6));

                    if (percentage24h > 0) {
                      percentage_24h_color = "color:#5bd7b9 !important";
                    } else if (percentage24h < 0) {
                      percentage_24h_color = "color:#e44f5c !important";
                    } else if (percentage24h == 0) {
                      percentage_24h_color = "color:#f1f1f1 !important";
                    }
                  } else {
                    percentage24h = "NEW";
                    percentage_24h_color = "color:#a185f2 !important";
                  }

                  data.percentage24h = percentage24h;
                  data.percentage_24h_color = percentage_24h_color;

                  //Listeye yeni giren yani bir önceki gün 100 milyon değilken bir sonraki 24h te 100 milyonun üzerinde ise bu coin işaretlenir,
                  //hali hazırda listede ise bir önceki güne göre sırasına göre yukarı asagı ok alır

                  if (formatted_last_48h_24h < 100) {
                    status_24h_icon =
                      "<div class='icon-container'><img width='16' src='star.svg'/></div>";
                  } else if (
                    id_24h - id_48h_24h < 0 &&
                    formatted_last_48h_24h > 100
                  ) {
                    status_24h_icon =
                      "<div class='icon-container'><img  width='14' src='up.svg'/></div>";
                  } else if (id_24h - id_48h_24h > 0) {
                    status_24h_icon =
                      "<div class='icon-container'><img width='14' src='down.svg'/></div>";
                  } else {
                    status_24h_icon = "<div class='icon-container'></div>";
                  }

                  data.status_24h_icon = status_24h_icon;

                  //Coinin volume değeri 100 milyon değilken bir sonraki 24hte 100 milyonun üzerinde ise bu coin yeşil işaretlenir. Bu yeşil olması için bir yükseliş trendinde yer alması gerekir.
                  if (
                    subs48_24 < 100 &&
                    formatted_last_24h > 100 &&
                    formatted_last_24h < 250 &&
                    data.close_24h > data.open_24h
                  ) {
                    color_24h = "color:#5bd7b9";
                  } else if (subs48_24 < 100 && formatted_last_24h > 250) {
                    color_24h = "color:#5bd7b9; font-weight:800";
                  } else if (
                    subs48_24 < 100 &&
                    formatted_last_24h > 100 &&
                    data.close_24h < data.open_24h
                  ) {
                    //color_24h = "color:#e44f5c";
                  }
                  data.color_24h = color_24h;
                });
              })
              .then(() => {
                coinPrevList = usdtCoins.slice();
              });
          } else {
            return;
          }
        } catch (e) {
          console.log(e);
        }
      });
    });
}

function getLiveCoinList() {
  var binancesocket = new WebSocket(
    "wss://stream.binance.com:9443/ws/!ticker@arr"
  );
  var usdtCoinsMomentary = [];

  binancesocket.onmessage = function (event) {
    usdtCoinsMomentary = [];
    var data = JSON.parse(event.data);
    data = data.filter(
      (coin) => coin.s.endsWith("USDT") && coin.q >= 100000000
    );

    usdtCoins.forEach((coin) => {
      var coinData = data.find(
        (coinData) => coinData.s.replace("USDT", "") == coin.symbol
      );

      if (coinData) {
        usdtCoinsMomentary.push(coinData);
      }
    });

    var t = "";
    for (var i = 0; i < usdtCoinsMomentary.length; i++) {
      if (
        usdtCoinsMomentary[i]["s"] != "BUSDUSDT" &&
        usdtCoinsMomentary[i]["s"] != "USDCUSDT" &&
        usdtCoinsMomentary[i]["s"] != "EURUSDT" &&
        usdtCoinsMomentary[i]["s"] != "TUSDUSDT" &&
        usdtCoinsMomentary[i]["s"] != "SUSDUSDT"
      ) {
        let prev24h_volume = usdtCoins[i].last_24h;
        let last24h_volume = parseFloat(usdtCoinsMomentary[i]["q"]);

        let symbol_status_color = "color:#f1f1f1 !important";

        let percentage24h = parseInt(
          ((last24h_volume - prev24h_volume) / prev24h_volume) * 100
        );
        let percentage24h_color = "";

        if (percentage24h > 0) {
          percentage24h_color = "color:#5bd7b9 !important";
        } else if (percentage24h < 0) {
          percentage24h_color = "color:#e44f5c !important";
        } else {
          percentage24h_color = "color:#f1f1f1 !important";
        }

        let live_price = parseFloat(usdtCoinsMomentary[i]["c"]);
        let prev24h_open_price = usdtCoins[i].open_24h;
        let percentage_price = 0;
        if (prev24h_open_price == 0) {
          percentage_price = -9999999999; //NEW
        } else {
          percentage_price = parseInt(
            ((live_price - prev24h_open_price) / prev24h_open_price) * 100
          );
        }

        let percentage_price_color = "";
        if (percentage_price == -9999999999) {
          percentage_price_color = "color:#a185f2 !important";
          percentage_price = "NEW";
        } else if (percentage_price > 0) {
          percentage_price_color = "color:#5bd7b9 !important";
        } else if (percentage_price < 0) {
          percentage_price_color = "color:#e44f5c !important";
        } else {
          percentage_price_color = "color:#f1f1f1 !important";
        }

        if (
          internationalNumberFormat.format(
            usdtCoins[i]["last_48h_24h"].toFixed(0).slice(0, -6)
          ) < 100
        ) {
          symbol_status_color = "color:#f58d00 !important";
        }
      }
    }

    if (usdtCoinsMomentary.length > 0) {
      coinLiveList = usdtCoinsMomentary.slice();
    }
  };
}

function get15mCandleList() {
  sorted_15m_30m_45m_60m = {};
  let symbol_list = [];
  let date = new Date();

  fetch("https://api.binance.com/api/v3/ticker/24hr")
    .then((response) => response.json())
    .then((data) => {
      data = data.filter(
        (coin) => coin.symbol.endsWith("USDT") && coin.quoteVolume >= 100000000
      );
      data.forEach((coin) => {
        let coin_symbol = coin.symbol;
        if (
          coin.symbol != "BUSDUSDT" &&
          coin.symbol != "USDCUSDT" &&
          coin.symbol != "EURUSDT" &&
          coin.symbol != "TUSDUSDT" &&
          coin.symbol != "SUSDUSDT"
        ) {
          symbol_list = [];

          usdtCoins.sort(function (a, b) {
            return b.last_24h - a.last_24h;
          });

          usdtCoins.forEach((usdtCoin) => {
            symbol_list.push(usdtCoin);
          });
        }
      });

      symbol_list.sort(function (a, b) {
        return b.last_24h - a.last_24h;
      });

      for (var i = 0; i < symbol_list.length; i++) {
        let symbol = symbol_list[i].symbol;
        let id = i;

        fetch(
          "https://api.binance.com/api/v3/klines?symbol=" +
            symbol +
            "USDT" +
            "&interval=15m&limit=5"
        )
          .then((response) => response.json())
          .then((data) => {
            let coin = {
              symbol: symbol,
              live_15m_0_volume: 0,
              live_15m_0_open_price: 0,
              live_15m_0_close_price: 0,
              live_15m_0_price_change_percent: 0,

              live_15m_1_volume: 0,
              live_15m_1_open_price: 0,
              live_15m_1_close_price: 0,
              live_15m_1_price_change_percent: 0,

              live_15m_2_volume: 0,
              live_15m_2_open_price: 0,
              live_15m_2_close_price: 0,
              live_15m_2_price_change_percent: 0,

              live_15m_3_volume: 0,
              live_15m_3_open_price: 0,
              live_15m_3_close_price: 0,
              live_15m_3_price_change_percent: 0,

              pulse_percent_15m_0: 0,
              pulse_percent_15m_1: 0,
              pulse_percent_15m_2: 0,
              pulse_percent_15m_3: 0,

              pulse_percent_15m_0_color: "",
              pulse_percent_15m_1_color: "",
              pulse_percent_15m_2_color: "",
              pulse_percent_15m_3_color: "",

              text_15m_0: "",
              text_15m_1: "",
              text_15m_2: "",
              text_15m_3: "",
            };

            coin.live_15m_0_volume = parseFloat(data[data.length - 1][7]);
            coin.live_15m_0_open_price = parseFloat(data[data.length - 1][1]);
            coin.live_15m_0_close_price = parseFloat(data[data.length - 1][4]);
            coin.live_15m_0_price_change_percent = parseFloat(
              ((coin.live_15m_0_close_price - coin.live_15m_0_open_price) /
                coin.live_15m_0_open_price) *
                100
            ).toFixed(2);

            coin.live_15m_1_volume = parseFloat(data[data.length - 2][7]);
            coin.live_15m_1_open_price = parseFloat(data[data.length - 2][1]);
            coin.live_15m_1_close_price = parseFloat(data[data.length - 2][4]);
            coin.live_15m_1_price_change_percent = parseFloat(
              ((coin.live_15m_1_close_price - coin.live_15m_1_open_price) /
                coin.live_15m_1_open_price) *
                100
            ).toFixed(2);

            coin.live_15m_2_volume = parseFloat(data[data.length - 3][7]);
            coin.live_15m_2_open_price = parseFloat(data[data.length - 3][1]);
            coin.live_15m_2_close_price = parseFloat(data[data.length - 3][4]);
            coin.live_15m_2_price_change_percent = parseFloat(
              ((coin.live_15m_2_close_price - coin.live_15m_2_open_price) /
                coin.live_15m_2_open_price) *
                100
            ).toFixed(2);

            coin.live_15m_3_volume = parseFloat(data[data.length - 4][7]);
            coin.live_15m_3_open_price = parseFloat(data[data.length - 4][1]);
            coin.live_15m_3_close_price = parseFloat(data[data.length - 4][4]);
            coin.live_15m_3_price_change_percent = parseFloat(
              ((coin.live_15m_3_close_price - coin.live_15m_3_open_price) /
                coin.live_15m_3_open_price) *
                100
            ).toFixed(2);

            let prev_24h_volume = usdtCoins[findId(usdtCoins, symbol)].last_24h;

            let pulse_15m = prev_24h_volume / 96;

            let pulse_percent_15m_3 = parseInt(
              ((parseFloat(coin.live_15m_3_volume) - pulse_15m) / pulse_15m) *
                100
            );
            let pulse_percent_15m_1 = parseInt(
              ((parseFloat(coin.live_15m_1_volume) - pulse_15m) / pulse_15m) *
                100
            );
            let pulse_percent_15m_2 = parseInt(
              ((parseFloat(coin.live_15m_2_volume) - pulse_15m) / pulse_15m) *
                100
            );
            let pulse_percent_15m_0 = parseInt(
              ((parseFloat(coin.live_15m_0_volume) - pulse_15m) / pulse_15m) *
                100
            );

            let pulse_percent_15m_3_color = "";
            let pulse_percent_15m_1_color = "";
            let pulse_percent_15m_2_color = "";
            let pulse_percent_15m_0_color = "";

            if (pulse_percent_15m_3 > 0) {
              pulse_percent_15m_3_color = "color:#5bd7b9 !important";
            } else if (pulse_percent_15m_3 < 0) {
              pulse_percent_15m_3_color = "color:#e44f5c !important";
            } else if (pulse_percent_15m_3 == 0) {
              pulse_percent_15m_3_color = "color:#f1f1f1 !important";
            }

            if (pulse_percent_15m_2 > 0) {
              pulse_percent_15m_2_color = "color:#5bd7b9 !important";
            } else if (pulse_percent_15m_2 < 0) {
              pulse_percent_15m_2_color = "color:#e44f5c !important";
            } else if (pulse_percent_15m_2 == 0) {
              pulse_percent_15m_2_color = "color:#f1f1f1 !important";
            }

            if (pulse_percent_15m_1 > 0) {
              pulse_percent_15m_1_color = "color:#5bd7b9 !important";
            } else if (pulse_percent_15m_1 < 0) {
              pulse_percent_15m_1_color = "color:#e44f5c !important";
            } else if (pulse_percent_15m_1 == 0) {
              pulse_percent_15m_1_color = "color:#f1f1f1 !important";
            }

            if (pulse_percent_15m_0 > 0) {
              pulse_percent_15m_0_color = "color:#5bd7b9 !important";
            } else if (pulse_percent_15m_0 < 0) {
              pulse_percent_15m_0_color = "color:#e44f5c !important";
            } else if (pulse_percent_15m_0 == 0) {
              pulse_percent_15m_0_color = "color:#f1f1f1 !important";
            }

            if (
              pulse_percent_15m_1 >= 250 &&
              parseFloat(coin.live_15m_1_price_change_percent) > 0.0
            ) {
              let coinObject = {
                symbol: coin.symbol,
                date: date.toLocaleString("fr-BE"),
                price_percent_15m_1: pulse_percent_15m_1 + "%",
                volume_15m_1: coin.live_15m_1_price_change_percent + "%",
              };

              let message_body =
                "[" +
                date.toLocaleString("fr-BE") +
                "] Tarihinde, " +
                coin.symbol +
                " coinde, 15m[-1] mumunda " +
                pulse_percent_15m_1 +
                "% hacim artışı ve " +
                coin.live_15m_1_price_change_percent +
                "% fiyat artışı gözlemlendi. ";

              //önce mesaj yolla sonra bu değeri yereldeki text e kaydet.
              console.log(message_body);
              let minutes = date.getMinutes();
              if (
                minutes == 1 ||
                minutes == 16 ||
                minutes == 31 ||
                minutes == 46
              ) {
                bot.sendMessage(chatId, message_body);
                controlAndSaveToFile(coinObject);
              }
            }

            let text_15m_0 =
              parseFloat(coin.live_15m_0_volume).toFixed(0).slice(0, -6) == ""
                ? parseInt(0)
                : internationalNumberFormat.format(
                    parseFloat(coin.live_15m_0_volume).toFixed(0).slice(0, -6)
                  );
            let text_15m_1 =
              parseFloat(coin.live_15m_1_volume).toFixed(0).slice(0, -6) == ""
                ? parseInt(0)
                : internationalNumberFormat.format(
                    parseFloat(coin.live_15m_1_volume).toFixed(0).slice(0, -6)
                  );
            let text_15m_2 =
              parseFloat(coin.live_15m_2_volume).toFixed(0).slice(0, -6) == ""
                ? parseInt(0)
                : internationalNumberFormat.format(
                    parseFloat(coin.live_15m_2_volume).toFixed(0).slice(0, -6)
                  );
            let text_15m_3 =
              parseFloat(coin.live_15m_3_volume).toFixed(0).slice(0, -6) == ""
                ? parseInt(0)
                : internationalNumberFormat.format(
                    parseFloat(coin.live_15m_3_volume).toFixed(0).slice(0, -6)
                  );

            coin.text_15m_0 = text_15m_0;
            coin.text_15m_1 = text_15m_1;
            coin.text_15m_2 = text_15m_2;
            coin.text_15m_3 = text_15m_3;
            coin.pulse_percent_15m_3 = pulse_percent_15m_3;
            coin.pulse_percent_15m_2 = pulse_percent_15m_2;
            coin.pulse_percent_15m_1 = pulse_percent_15m_1;
            coin.pulse_percent_15m_0 = pulse_percent_15m_0;
            coin.pulse_percent_15m_3_color = pulse_percent_15m_3_color;
            coin.pulse_percent_15m_2_color = pulse_percent_15m_2_color;
            coin.pulse_percent_15m_1_color = pulse_percent_15m_1_color;
            coin.pulse_percent_15m_0_color = pulse_percent_15m_0_color;

            sorted_15m_30m_45m_60m[id] = coin;
          })
          .then(() => {
            var t = "";
            Object.keys(sorted_15m_30m_45m_60m).reduce(
              (a, c) => ((a[c] = sorted_15m_30m_45m_60m[c]), a),
              {}
            );
          });
      }
    });
}

function sendStarMessage() {
  let date = new Date();
  let message_body =
    "[" +
    date.toLocaleString("fr-BE") +
    "] - Tarihinde listeye giren coinler : ";

  coinPrevList.forEach(function (coin) {
    if (
      coin.status_24h_icon ==
      "<div class='icon-container'><img width='16' src='star.svg'/></div>"
    ) {
      message_body += coin.symbol + " - ";
    }
  });
  bot.sendMessage(chatId, message_body);
}

function findId(arr, val) {
  for (var i = 0; i < arr.length; i++) if (arr[i].symbol === val) return i;
  return false;
}

function saveToDb() {
  //Yıldız olan coinleri database e kaydet. Kaydederken bu coinin daha önceden var olup olmadığına bak.
  //önce sil sonra kaydet.
  let starsArray = [];
  coinPrevList.forEach(function (coin) {
    if (
      coin.status_24h_icon ==
      "<div class='icon-container'><img width='16' src='star.svg'/></div>"
    ) {
      starsArray.push(coin);
    }
  });

  Stars.controlAndRemoveItem(starsArray);

  Stars.controlAndSaveItem(starsArray);
}

function controlAndSaveToFile(coinObject) {
  fs.readFile("./files/15m_1_coins.json", "utf8", function (err, jsonString) {
    if (err) {
    } else {
      try {
        let symbol_array = JSON.parse(jsonString);
        let id = findId(symbol_array, coinObject.symbol);

        if (!id) {
          symbol_array.push(coinObject);
        } else {
          symbol_array[id].volume_15m_1 = coinObject.volume_15m_1;
          symbol_array[id].date = coinObject.date;
          symbol_array[id].price_percent_15m_1 = coinObject.price_percent_15m_1;
        }

        fs.writeFile(
          "./files/15m_1_coins.json",
          JSON.stringify(symbol_array, null, 2),
          (err) => {
            if (err) {
              console.log(err);
            }
          }
        );
      } catch (err) {
        console.log(err);
      }
    }
  });
}

function clearFile(filename) {
  fs.writeFile(filename, "[]", (err) => {
    if (err) {
      console.log(err);
    }
  });
}
