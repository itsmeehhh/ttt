import { PageID, PAGE_ACCESS_TOKEN, APP_SECRET, allowedUsers, winRobot, loseRobot, drawRobot, loseMessages, winMessages, welcome, welcome2, noDefeat, op_fr_winmsg, op_fr_losemsg } from './words.js';
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import Botly from 'botly';
/*-----def-----*/
dotenv.config();
const port = 8080;
const app = express();
let userBoards = {};
let gameSessions = {};
let awaitingInviteCode = {};
let globalWaitingPlayers = [];
let globalGameSessions = {};
let globalSearchingPlayers = new Set();
const player1 = '❌';
const player2 = '⚪';
const computer = '⚪';
/*------ sentences ------*/ 
function getRandomMessage(messages) {
  let shuffled = [...messages].sort(() => Math.random() - 0.5);
  return shuffled[0];
}

/*------ page database ------*/

const botly = new Botly({
  accessToken: PAGE_ACCESS_TOKEN,
  verifyToken: '12345678',
  webHookPath: process.env.WB_PATH,
  notificationType: Botly.CONST.REGULAR,
  FB_URL: "https://graph.facebook.com/v18.0/",
});

app.get("/", function (_req, res) {
  res.sendStatus(200);
});
app.use(
  bodyParser.json({
    verify: botly.getVerifySignature(APP_SECRET),
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/webhook", botly.router());
/*--------- Messages ---------*/
      botly.on("message", async (senderId, message, data) => {
     botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.MARK_SEEN});
                                 botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_ON});

 if (message.message.text) {
   if (message.message.text.startsWith("inv")) {
      if (!allowedUsers.includes(senderId)) { 
        return /*botly.sendText({
               id: senderId,
               text: "❌ لا يُسمح لك باستخدام هذا الأمر."
           });*/
       }

       if (isPlayerInGame(senderId)) {
           return botly.sendText({
               id: senderId,
               text: "⚠️ لا يمكنك إنشاء دعوة لأنك بالفعل في مباراة."
           });
       }

       const rounds = parseInt(message.message.text.split(" ")[1]);
       if (isNaN(rounds) || rounds <= 0) {
           return botly.sendText({
               id: senderId,
               text: "❌ يرجى تحديد عدد الجولات بشكل صحيح. مثلًا: inv 5"
           });
       }
     initiateMultiplayerGame(senderId, rounds);

   } else if (message.message.text == 'out') {
       let foundSession = false;
  //الانسحاب في وضع اللعب مع البوت
  if (userBoards[senderId]) {
           foundSession = true;

     showMainMenu(senderId, getRandomMessage(op_fr_losemsg));
         delete userBoards[senderId];
         return;
       }

   //الانسحاب في وضع اللعب مع صديق 
       for (const sessionId in gameSessions) {
           const session = gameSessions[sessionId];
           if (session.player1 === senderId || session.player2 === senderId) {
               foundSession = true;
               const otherPlayer = session.player1 === senderId ? session.player2 : session.player1;

               delete gameSessions[sessionId];
showMainMenu(senderId, getRandomMessage(op_fr_losemsg));
               if (otherPlayer) {
                   showMainMenu(otherPlayer, getRandomMessage(op_fr_winmsg));
               }
                 return;
           }
       }

 //الانسحاب في وضع اللعب العالمي
       for (const sessionId in globalGameSessions) {
           const session = globalGameSessions[sessionId];
           if (session.player1 === senderId || session.player2 === senderId) {
               foundSession = true;
               const otherPlayer = session.player1 === senderId ? session.player2 : session.player1;
               delete globalGameSessions[sessionId];

               showMainMenu(senderId, getRandomMessage(op_fr_losemsg));
               if (otherPlayer) {
                   showMainMenu(otherPlayer, getRandomMessage(op_fr_winmsg));
               }
                 return;
           }
       }

       if (!foundSession) {
   //        showMainMenu(senderId, "❌ لا يوجد جلسة لعب حالياً لإنهائها!");
       }
   }

          const text = message.message.text.trim();

          if (awaitingInviteCode[senderId]) {
            // التحقق من كود الدعوة المدخل
            const sessionId = Object.keys(gameSessions).find(id => gameSessions[id].inviteCode === text && gameSessions[id].player2 === null);
            if (sessionId) {
              gameSessions[sessionId].player2 = senderId;
              resetMultiplayerSessionTimeout(sessionId);
              delete awaitingInviteCode[senderId];
              botly.sendText({
                id: gameSessions[sessionId].player1,
                text: `قام صديقك بالانضمام للعبة عبر كود الدعوة!\nيمكنكم اللعب معا الان\nرمزك هو ${player1} و رمز صديقك ${player2}`
              });
              botly.sendText({
                id: senderId,
                text: `قمت بالانضمام الى اللعبة عبر كود الدعوة!\n يمكنك اللعب مع صديقك الان\nرمزك هو ${player2} و رمز صديقك ${player1}\nعدد الجولات : ${gameSessions[sessionId].totalRounds}
`
              });
              setTimeout(() => {
                botly.sendText({
                  id: gameSessions[sessionId].player1,
                  text: `بدأت اللعبة!\n${printBoard(gameSessions[sessionId].board)}\n${gameSessions[sessionId].currentPlayer === gameSessions[sessionId].player1 ? 'حان دورك! (إختر بين 1-9)' : 'في إنتظار ان يلعب صديقك...'}`
                });
              }, 1000);
              setTimeout(() => {
                botly.sendText({
                  id: senderId,
                  text: `بدأت اللعبة!\n${printBoard(gameSessions[sessionId].board)}\n${gameSessions[sessionId].currentPlayer === gameSessions[sessionId].player2 ? 'حان دورك! (إختر بين 1-9)' : 'في إنتظار ان يلعب صديقك...'}`
                });
              }, 1000);
            } else {
               setTimeout(() => {
     botly.sendText({
       id: senderId,
       text: 'كود الدعوة غير صالح 😑\n تأكد ان صديقك ارسل لك الكود بشكل صحيح',
       quick_replies: [botly.createQuickReply('الغاء الادخال', 'CANCEL_ENTER_INVITE_CODE')]
     });
   }, 1000);
            }
          } else if (userBoards[senderId]) {
            const move = parseInt(text);
            if (!isNaN(move) && move >= 1 && move <= 9) {
              handlePlayerMove(senderId, move);
            } else {
              botly.sendText({
                id: senderId,
                text: 'الرجاء اختيار بين 1 الى 9 فقط 😠 '
              });
            }
          } else if (Object.values(globalGameSessions).some(session => session.player1 === senderId || session.player2 === senderId)) {
            const sessionId = Object.keys(globalGameSessions).find(id => globalGameSessions[id].player1 === senderId || globalGameSessions[id].player2 === senderId);
            const session = globalGameSessions[sessionId];

            if (session.currentPlayer === senderId) {
                const move = parseInt(message.message.text);
                if (!isNaN(move) && move >= 1 && move <= 9) {
                    handleGlobalMove(sessionId, senderId, move);
                } else {
                    botly.sendText({
                        id: senderId,
                        text: "❌ الرجاء اختيار رقم صحيح بين 1 و 9!"
                    });
                }
            } else {
                botly.sendText({
                    id: senderId,
                    text: "⏳ لم يحن دورك بعد، انتظر حتى يلعب خصمك."
                });
            } 
          } else if (globalSearchingPlayers.has(senderId)) {
            setTimeout(() => {
        botly.sendText({
            id: senderId,
            text: "⚠️ يرجى عدم إرسال أي شيء، يتم البحث عن لاعبين حاليًا...\nاو يمكنك الغاء البحث عبر الزر.",
            quick_replies: [ 
                botly.createQuickReply('❌ إلغاء البحث', `CANCEL_GLOBAL_SEARCH_${senderId}`)
            ]
        });
    }, 2000);
              return;
          } else if (Object.values(gameSessions).some(session => session.player1 === senderId || session.player2 === senderId)) {
            const sessionId = Object.keys(gameSessions).find(id => gameSessions[id].player1 === senderId || gameSessions[id].player2 === senderId);
            const session = gameSessions[sessionId];

            if (session.player2 === null) {
              botly.sendText({
                id: senderId,
                text: 'لا ترسل شيء حتى يدخل صديقك 😠\n ارسل له كود الدعوة لكي ينضم للعبة\n او يمكنك الغاء الدعوة',
                quick_replies: [botly.createQuickReply('إلغاء الدعوة', `CANCEL_INVITE_${sessionId}`)]
              });
            } else if (session.currentPlayer === senderId) {
              const move = parseInt(text);
              if (!isNaN(move) && move >= 1 && move <= 9) {
                handleMultiplayerMove(sessionId, senderId, move);
              } else {
                botly.sendText({
                  id: senderId,
                  text: 'الرجاء الإختيار بين 1 الى 9 فقط 😠'
                });
              }
            } else {
              botly.sendText({
                id: senderId,
                text: 'لم يأتي دورك بعد، من فضلك انتظر حتى يلعب صديقك.'
              });
            }
          } else {
            botly.sendText({ id: senderId, text: getRandomMessage(welcome) });
            setTimeout(() => {
              showMainMenu(senderId, welcome2);
            }, 1000);
          }
    } else if (message.message.attachments[0].payload.sticker_id) {
       botly.sendText({id: senderId, text: "يرجى ارسال النصوص فقط 😠"});
            } else if (message.message.attachments[0].type == "image") {
            botly.sendText({id: senderId, text: "يرجى ارسال النصوص فقط 😠"});
               } else if (message.message.attachments[0].type == "audio") {
               botly.sendText({id: senderId, text: "يرجى ارسال النصوص فقط 😠"});
                 } else if (message.message.attachments[0].type == "video") {
                  botly.sendText({id: senderId, text: "يرجى ارسال النصوص فقط 😠"});
                  }
       botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_OFF});
                               });

/*--------- Postbacks ---------*/
 botly.on("postback", async (senderId, message, postback, data, ref) => {
       botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.MARK_SEEN});
       botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_ON});

      if (postback == "GET_STARTED") { 
      botly.sendText({ id: senderId, text: getRandomMessage(welcome) });
        setTimeout(() => {
        showMainMenu(senderId, welcome2);
        }, 1000);
         } if (postback == "BOT_FIRST") {
        if (userBoards[senderId].userStarted) {
          /*botly.sendText({
            id: senderId,
            text: "⚠️ لا يمكنك الضغط على هذا الزر بعد أن بدأت اللعب!\nاكمل اللعب 🤧"
          });*/
          return; 
        }
    if (userBoards[senderId]) {
      userBoards[senderId].userStarted = true;

      const randomMove = Math.floor(Math.random() * 9) + 1;
makeMove(userBoards[senderId], randomMove, computer);
setTimeout(() => {
      botly.sendText({
        id: senderId,
        text: `لقد لعبت أولاً واخترت المكان ${randomMove}!\n${printBoard(userBoards[senderId])}\nحان دورك! (اختر بين 1-9)`
      });
}, 1000);
      // إعادة تعيين المهلة (timeout) بعد حركة البوت
      if (userBoards[senderId].timeout) {
        clearTimeout(userBoards[senderId].timeout);
      }
      userBoards[senderId].timeout = setTimeout(() => {
        endGameDueToInactivity(senderId);
      }, 5 * 60 * 1000); // 5 دقائق
    }
  } else if (postback == "Owner") {
          botly.sendGeneric({id: senderId, elements: {
                      title: "Morocco AI",
                      image_url: "https://telegra.ph/file/6db48bb667028c068d85a.jpg",
                     subtitle: " اضغط لمتابعة الصفحة ❤️👇🏻",
                    buttons: [
                    botly.createWebURLButton("صفحة المطور 🇲🇦😄", "https://www.facebook.com/profile.php?id=100090780515885")]},
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL});
         } else if (postback == "RESTART") {  
        setTimeout(() => {
        botly.sendText({
          id: senderId,
          text: 'اختر مستوى الصعوبة',
          quick_replies: [
            botly.createQuickReply('سهل 🤧', 'EASY_LEVEL'),
            botly.createQuickReply('متوسط 😈', 'MEDIUM_LEVEL'),
            botly.createQuickReply('صعب 💀', 'HARD_LEVEL'),
             botly.createQuickReply('رجوع ↪️', 'BACK_TO_HOME')
          ]
        });
        }, 1000);
      } else if (postback == "EASY_LEVEL") {
        startGame(senderId, 'easy');
      } else if (postback == "MEDIUM_LEVEL") {
        startGame(senderId, 'medium');
      } else if (postback == "HARD_LEVEL" && !userBoards[senderId]) {
        setTimeout(() => {
          botly.sendText({
              id: senderId,
              text: getRandomMessage(noDefeat)
          });
        }, 500);
        startGame(senderId, 'hard');
      } else if (postback == "INVITE_FRIEND") {
  setTimeout(() => {
    botly.sendText({
         id: senderId,
        text: 'ما عدد الجولات التي تريد؟',
     quick_replies: [ 
botly.createQuickReply('جولة واحدة', 'INVITE_SINGLE_ROUND'),
        botly.createQuickReply('3 جولات', 'INVITE_THREE_ROUND'),
       botly.createQuickReply('5 جولات', 'INVITE_FIVE_ROUNDS'),
                   botly.createQuickReply('10 جولات', 'INVITE_TEN_ROUNDS'),
                   botly.createQuickReply('رجوع', 'BACK_TO_HOME')
                 ]
             });
  }, 1000);
        } else if (postback && postback.startsWith("CANCEL_INVITE_")) {
            const inviteCode = postback.split("CANCEL_INVITE_")[1];
            invalidateInviteCode(inviteCode);
          } else if (postback == "INVITE_SINGLE_ROUND") {
            initiateMultiplayerGame(senderId, 1);
          } else if (postback == "INVITE_THREE_ROUND") {
        initiateMultiplayerGame(senderId, 3);
      } else if (postback == "INVITE_FIVE_ROUNDS") {
            initiateMultiplayerGame(senderId, 5);
          } else if (postback == "INVITE_TEN_ROUNDS") {
        initiateMultiplayerGame(senderId, 10);
      } else if (postback == "BACK_TO_HOME") {
        botly.sendText({ id: senderId, text: getRandomMessage(welcome) });

         setTimeout(() => {
        showMainMenu(senderId, welcome2);
         }, 1000);
           } else if (postback == "ENTER_INVITE_CODE") {
     awaitingInviteCode[senderId] = true;
   setTimeout(() => {
     botly.sendText({
       id: senderId,
       text: 'ادخل كود الدعوة الذي ارسله لك صديقك',
       quick_replies: [botly.createQuickReply('الغاء الادخال ❌', 'CANCEL_ENTER_INVITE_CODE')]
     });
   }, 1000);
   } else if (postback == "CANCEL_ENTER_INVITE_CODE") {
     delete awaitingInviteCode[senderId];

      botly.sendText({ id: senderId, text: getRandomMessage(welcome) });
     setTimeout(() => {
        showMainMenu(senderId, welcome2);
         }, 1000);
   } else if (postback == "GLOBAL_MATCH") {
          startGlobalMatch(senderId);
      } else if (postback && postback.startsWith("CANCEL_GLOBAL_SEARCH_")) {
          let playerId = postback.split("CANCEL_GLOBAL_SEARCH_")[1];

          let index = globalWaitingPlayers.indexOf(playerId);
          if (index !== -1) {
              globalWaitingPlayers.splice(index, 1);
          }
       globalSearchingPlayers.delete(playerId);

          setTimeout(() => {
              showMainMenu(playerId, 'تم الغاء البحث.\nيمكنك بدء لعبة جديدة أو تجربة اللعب مع صديق.');
          }, 1000);

          return;
      }



botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_OFF});
                      });
     botly.setGetStarted({pageId: PageID, payload: "GET_STARTED"});
      botly.setGreetingText({
      pageId: PageID,
     greeting: [
       {
        locale: "default",
        text: "           tic tac toe \n اول لعبة إكس اوو على الفيسبوك صنعت من طرف فريق\nMoroccoAI"
           }]});
   botly.setPersistentMenu({
   pageId: PageID,
  menu: [
    {
locale: "default",
composer_input_disabled: false,
                call_to_actions: [{
        type:  "web_url",
        title: "صفحة المطور 🇲🇦😄",
        url:   "fb.com/Morocco.Openai/",
       webview_height_ratio: "full"
            }]}]});
 app.listen(port, () => {
 console.log(`Server running on port ${port}`);                  });

/*--------- Functions ---------*/
function showMainMenu(senderId, text) {
  botly.sendText({
    id: senderId,
    text: text,
    quick_replies: [
      botly.createQuickReply('اللعب مع البوت', 'RESTART'),
      botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND'),
      botly.createQuickReply('اللعب العالمي', 'GLOBAL_MATCH'),

botly.createQuickReply('ادخال كود الدعوة', 'ENTER_INVITE_CODE')
    ]
  });
}

function initBoard() {
  return ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
}

function printBoard(board) {
    let newBoard = [...board]; // إنشاء نسخة من اللوحة الأصلية
    const winConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // الصفوف
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // الأعمدة
        [0, 4, 8], [2, 4, 6]  // الأقطار
    ];

    for (let condition of winConditions) {
        const [a, b, c] = condition;
        if (board[a] === board[b] && board[b] === board[c] && (board[a] === ` ${player1}` || board[a] === ` ${player2}`)) {
            newBoard[a] = board[a] === ` ${player1}` ? ` ✖️` : ` 🟢`;
            newBoard[b] = board[b] === ` ${player1}` ? ` ✖️` : ` 🟢`;
            newBoard[c] = board[c] === ` ${player1}` ? ` ✖️` : ` 🟢`;
            break; 
        }
    }

    return `
    ${newBoard[0]} | ${newBoard[1]} | ${newBoard[2]}
    ---------------------
    ${newBoard[3]} | ${newBoard[4]} | ${newBoard[5]}
    ---------------------
    ${newBoard[6]} | ${newBoard[7]} | ${newBoard[8]}
  `;
}


// التعامل مع اللعب مع الكمبيوتر والمستويات
function startGame(senderId, level) {
  if (userBoards[senderId]) return;
  userBoards[senderId] = initBoard();
  userBoards[senderId].level = level;
  userBoards[senderId].isAwaitingBotMove = false; // <-- السطر المضاف هنا
  userBoards[senderId].userStarted = false; // تأكد من تهيئة هذه أيضاً

  userBoards[senderId].timeout = setTimeout(() => {
    endGameDueToInactivity(senderId);
  }, 5 * 60 * 1000); // 5 دقائق

  setTimeout(() => {
    botly.sendText({
      id: senderId,
     text: `رمزك ${player1} و رمزي ${computer}\n${printBoard(userBoards[senderId])}\nارسل رقما لكي تلعب اولا\nاو إضغط الزر ليلعب البوت اولا`,
    quick_replies: [
      botly.createQuickReply('البوت اولا', 'BOT_FIRST')
    ]
    });
  }, 1200);
}

function endGame(senderId, message) {
    if (userBoards[senderId] && userBoards[senderId].timeout) {
        clearTimeout(userBoards[senderId].timeout);
    }
  const level = userBoards[senderId].level;
  const Diflevel  = level === 'easy' ? 'سهل 😂' : level === 'medium' ? 'متوسط 😐' : 'صعب 😈';

    botly.sendText({
        id: senderId,
        text: `انتهت اللعبة 😉\nالمستوى: ${Diflevel}\n${printBoard(userBoards[senderId])}\n${message}`
    }, function() {
        setTimeout(() => {
            showMainMenu(senderId, 'يمكنك إعادة اللعب');
        }, 1000);
    });
    delete userBoards[senderId];
}


function makeMove(board, position, symbol) {
  const pos = position - 1;
  if (board[pos] !== ` ${player1}` && board[pos] !== ` ${player2}` && board[pos] !== ` ${computer}`) {
    board[pos] = ` ${symbol}`;
    return true;
  }
  return false;
}

function checkWin(board, symbol) {
  const winConditions = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
    [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
    [0, 4, 8], [2, 4, 6] // Diagonals
  ];
  return winConditions.some(condition =>
    condition.every(index => board[index] === ` ${symbol}`)
  );
}

function checkDraw(board) {
  return board.every(cell => cell === ` ${player1}` || cell === ` ${player2}`);
}

function easyComputerMove(board, player1Move) {
  // 80% من الحركات تكون عشوائية
  const randomFactor = Math.random();
  if (randomFactor < 0.8) {
    const emptyPositions = board
      .map((value, index) => (value !== ` ${player1}` && value !== ` ${computer}` ? index + 1 : null))
      .filter(value => value !== null);
    if (emptyPositions.length === 0) return null;
    return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  } else {
    // 20% من الحركات تستخدم minimax
    return minimax(board, computer).index;
  }
}

function mediumComputerMove(board, player1Move) {
  // 40% من الحركات تستخدم minimax
  const smartMove = Math.random() < 0.6;
  if (smartMove) {
    return minimax(board, computer).index;
  } else {
    // 60% من الحركات تكون عشوائية
    const emptyPositions = board
      .map((value, index) => (value !== ` ${player1}` && value !== ` ${computer}` ? index + 1 : null))
      .filter(value => value !== null);
    if (emptyPositions.length === 0) return null;
    return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
  }
}


function hardComputerMove(board, player1Move) {
  return minimax(board, computer).index;
}

function minimax(board, player) {
  const availableSpots = board.filter((cell) => cell !== ` ${player1}` && cell !== ` ${player2}`);

  if (checkWin(board, computer)) {
    return { score: 10 }; // الكمبيوتر فاز
  } else if (checkWin(board, player1)) {
    return { score: -10 }; // اللاعب فاز
  } else if (availableSpots.length === 0) {
    return { score: 0 }; // تعادل
  }

  let moves = [];

  for (let i = 0; i < board.length; i++) {
    if (board[i] !== ` ${player1}` && board[i] !== ` ${player2}`) {
      let move = {};
      move.index = i + 1; // تحديد مكان الحركة 
      move.score = null; 

      let boardCopy = [...board];
      boardCopy[i] = ` ${player}`; // إجراء الحركة

      if (player === computer) {
        move.score = minimax(boardCopy, player1).score; // تحليل حركة اللاعب 
      } else {
        move.score = minimax(boardCopy, computer).score; // تحليل حركة الكمبيوتر
      }

      moves.push(move); 
    }
  }

  let bestMove;

  if (player === computer) {
    // اختيار الحركة مع أعلى نتيجة للكمبيوتر
    let bestScore = -Infinity;
    moves.forEach((move) => {
      if (move.score > bestScore) {
        bestScore = move.score;
        bestMove = move;
      }
    });
  } else {
    // اختيار الحركة مع أقل نتيجة لللاعب
    let bestScore = Infinity;
    moves.forEach((move) => {
      if (move.score < bestScore) {
        bestScore = move.score;
        bestMove = move;
      }
    });
  }

  return bestMove;
}

function handlePlayerMove(senderId, move) {
  let board = userBoards[senderId];
  if (!board) return;

  if (board.isAwaitingBotMove) {
      botly.sendText({
          id: senderId,
          text: '⏳ انتظر حتى ألعب دوري!'
      });
      return;
  }

  if (board.timeout) {
    clearTimeout(board.timeout);
  }

  if (!board.userStarted) {
    board.userStarted = true;
  }

  if (makeMove(board, move, player1)) {
    board = userBoards[senderId];

    if (!checkWin(board, player1) && !checkWin(board, computer) && !checkDraw(board)) {
        botly.sendText({
            id: senderId,
            text: `انت اخترت المكان ${move}\n${printBoard(board)}\nحان دوري، انتظر حركتي 👇🏻`
        });
    }

    board.isAwaitingBotMove = true;

    if (checkWin(board, player1)) {
      endGame(senderId, getRandomMessage(loseRobot));
      return;
    } else if (checkDraw(board)) {
      endGame(senderId, getRandomMessage(drawRobot));
      return;
    }

    if (board.userStarted) {
      board.botFirstDisabled = true;
    }

    setTimeout(() => {
      if (!userBoards[senderId]) {
          return;
      }
      let currentBoard = userBoards[senderId];

      let computerMovePosition;
      if (currentBoard.level === 'easy') {
        computerMovePosition = easyComputerMove(currentBoard, move);
      } else if (currentBoard.level === 'medium') {
        computerMovePosition = mediumComputerMove(currentBoard, move);
      } else if (currentBoard.level === 'hard') {
        computerMovePosition = hardComputerMove(currentBoard, move);
      }

      if (computerMovePosition) {
        makeMove(currentBoard, computerMovePosition, computer);

        currentBoard.isAwaitingBotMove = false;

        if (checkWin(currentBoard, computer)) {
          endGame(senderId, getRandomMessage(winRobot));
        } else if (checkDraw(currentBoard)) {
          endGame(senderId, getRandomMessage(drawRobot));
        } else {
          botly.sendText({
            id: senderId,
            text: `سأختار المكان ${computerMovePosition}\n${printBoard(currentBoard)}\nحان دورك! (إختر بين 1 إلى 9)`
          });
          if (currentBoard.timeout) clearTimeout(currentBoard.timeout);
           currentBoard.timeout = setTimeout(() => {
               endGameDueToInactivity(senderId);
           }, 5 * 60 * 1000);
        }
      } else {
         if(userBoards[senderId]) {
             userBoards[senderId].isAwaitingBotMove = false;
         }
        delete userBoards[senderId];
        showMainMenu(senderId, 'حدث لي خطأ، يمكنك اعادة اللعب من جديد');
      }
      }, 2000);
  } else {
    botly.sendText({
      id: senderId,
      text: 'المكان محدد مسبقا, حاول تحديد مكان اخر! (إختر بين 1-9)'
    });
  }
}

// تعامل مع اللاعبين وكود الدعوة
function generateInviteCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'MOROCCOAI';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

function resetMultiplayerSessionTimeout(sessionId) {
  const session = gameSessions[sessionId];
  if (session.timeout) {
    clearTimeout(session.timeout);
  }
  session.timeout = setTimeout(() => {
    invalidateMultiplayerSession(sessionId);
  }, 5 * 60 * 1000);
}

function invalidateMultiplayerSession(sessionId) {
  const session = gameSessions[sessionId];
  if (session) {
    delete gameSessions[sessionId];
    botly.sendText({
      id: session.player1,
      text: 'لقد انتهت اللعبة بسبب انكما لم تكملا اللعب 😐'
    }, function() {
      setTimeout(() => {
showMainMenu(session.player1, 'يمكنك اعادة اللعب');
      }, 1000);
    });

    botly.sendText({
      id: session.player2,
      text: 'تم انهاء اللعبة بسبب انكما لم تكملا اللعب 😐'
    }, function() {
      setTimeout(() => {
showMainMenu(session.player2, 'يمكنك اعادة اللعب');
      }, 1000);
    });
  }
}

function initiateMultiplayerGame(senderId, totalRounds) {
  if (Object.values(gameSessions).some(session => session.player1 === senderId && session.player2 === null)) {
      return;}
    const inviteCode = generateInviteCode();
    gameSessions[inviteCode] = {
        player1: senderId,
        player2: null,
        board: initBoard(),
        currentPlayer: senderId,
        inviteCode: inviteCode,
        totalRounds: totalRounds,
        currentRound: 1,
        scores: { player1: 0, player2: 0 }
    };
  setTimeout(() => {
    botly.sendText({
        id: senderId,
        text: `ارسل هذا الكود الى صديقك وقل له ان يراسل صفحتي ويضغط على زر 'ادخال كود الدعوة' ويرسله وسيبدأ اللعب بينكما \n\nتنتهي مدة صلاحية الدعوة بعد 5 دقائق او يمكنك انهاؤها عبر الزر`
    });
}, 1000);
  setTimeout(() => {
    botly.sendText({
        id: senderId,
        text: `${inviteCode}`,
        quick_replies: [botly.createQuickReply('إلغاء الدعوة', `CANCEL_INVITE_${inviteCode}`)]
    });
  }, 2000);
    setTimeout(() => {
        invalidateInviteCode(inviteCode);
    }, 5 * 60 * 1000);
}

function handleMultiplayerMove(sessionId, player, move) {
    const session = gameSessions[sessionId];
    const board = session.board;
    const currentPlayer = player === session.player1 ? player1 : player2;

    if (makeMove(board, move, currentPlayer)) {
        resetMultiplayerSessionTimeout(sessionId);

        const nextPlayer = player === session.player1 ? session.player2 : session.player1;
        const currentMoveText = `لقد اخترت المكان ${move}`;
        const friendMoveText = `صديقك اختار المكان ${move}`;

      if (checkWin(board, currentPlayer)) {
          session.scores[currentPlayer === player1 ? 'player1' : 'player2']++;

          botly.sendText({
              id: session.player1,
              text: `انتهت الجولة ${session.currentRound}!\n${currentPlayer === player1 ? 'انت الفائز فيها 🥳!' : 'صديقك الفائز فيها 🥳!'}\n${printBoard(board)}\n------------\nنقاطك: ${session.scores.player1}, نقاط صديقك: ${session.scores.player2}\n`
          });

          botly.sendText({
              id: session.player2,
              text: `انتهت الجولة ${session.currentRound}!\n${currentPlayer === player1 ? 'صديقك الفائز فيها 🥳!' : 'انت الفائز فيها 🥳!'}\n${printBoard(board)}\n------------\nنقاطك: ${session.scores.player2}, نقاط صديقك: ${session.scores.player1}\n`
          });

          if (session.currentRound < session.totalRounds) {
              session.currentRound++;
              session.board = initBoard();
              setTimeout(() => {
                  botly.sendText({
                      id: session.player1,
                      text: `الجولة ${session.currentRound} تبدأ الان!\n${printBoard(session.board)}\n${session.currentPlayer === session.player1 ? 'حان دورك! (إختر بين 1-9)' : 'في إنتظار أن يلعب صديقك...'}`
                  });
              }, 1000);
              setTimeout(() => {
                  botly.sendText({
                      id: session.player2,
                      text: `الجولة ${session.currentRound} تبدأ الان!\n${printBoard(session.board)}\n${session.currentPlayer === session.player2 ? 'حان دورك! (إختر بين 1-9)' : 'في إنتظار أن يلعب صديقك...'}`
                  });
              }, 1000);
          } else {
              endMultiplayerGame(sessionId, `اللعبة انتهت بعد ${session.totalRounds} جولات!\nنقاطك: ${session.scores.player1}, نقاط صديقك: ${session.scores.player2}`);
          }
      }  else if (checkDraw(board)) {
        session.scores.player1++;
session.scores.player2++;
            botly.sendText({
                id: session.player1,
                text: `انتهت الجولة ${session.currentRound} بتعادل 😂!\n${printBoard(board)}\n------------\nنقاطك: ${session.scores.player1}, نقاط صديقك: ${session.scores.player2}`
            });
            botly.sendText({
                id: session.player2,
                text: `انتهت الجولة ${session.currentRound} بتعادل 😂!\n${printBoard(board)}\n------------\nنقاطك: ${session.scores.player2}, نقاط صديقك: ${session.scores.player1}`
            });
            if (session.currentRound < session.totalRounds) {
                session.currentRound++;
                session.board = initBoard();
        setTimeout(() => {
                botly.sendText({
                    id: session.player1,
                    text: `الجولة ${session.currentRound} تبدأ الان!\n${printBoard(session.board)}\n${session.currentPlayer === session.player1 ? 'حان دورك! (إختر بين 1-9)' : 'في إنتظار أن يلعب صديقك...'}`
                });
        }, 1000);
      setTimeout(() => {
       botly.sendText({
                    id: session.player2,
                    text: `الجولة ${session.currentRound} تبدأ الان!\n${printBoard(session.board)}\n${session.currentPlayer === session.player2 ? 'حان دورك! (إختر بين 1-9)' : 'في إنتظار أن يلعب صديقك...'}`
                });
      }, 1000);
            } else {
                endMultiplayerGame(sessionId, `اللعبة انتهت بعد ${session.totalRounds} جولات!\nنقاطك: ${session.scores.player1}, نقاط صديقك: ${session.scores.player2}`);
            }
        } else {
            botly.sendText({
                id: session.player1,
                text: `${player === session.player1 ? currentMoveText : friendMoveText}\n${printBoard(board)}\n${nextPlayer === session.player1 ? 'حان دورك! (إختر بين 1 الى 9 )' : 'في إنتظار أن يلعب صديقك...'}`
            });
            botly.sendText({
                id: session.player2,
                text: `${player === session.player2 ? currentMoveText : friendMoveText}\n${printBoard(board)}\n${nextPlayer === session.player2 ? 'حان دورك! (إختر بين 1 الى 9 )' : 'في إنتظار أن يلعب صديقك...'}`
            });
            session.currentPlayer = nextPlayer;
        }
    } else {
        botly.sendText({
            id: player,
            text: 'المكان محدد مسبقا، حدد مكانا اخر! (إختر بين 1-9)'
        });
    }
}

function endMultiplayerGame(sessionId, endMessage) {
    const session = gameSessions[sessionId];
    const { player1, player2, scores } = session;
    const { player1: score1, player2: score2 } = scores;

    delete gameSessions[sessionId];

    let resultMessage1 = '';
    let resultMessage2 = '';

    if (score1 > score2) {
        resultMessage1 = `--------------------\nالنتيجة النهائية\n--------------------\n${endMessage}\nإذن: انت الفائز 🥳!`;
        resultMessage2 = `--------------------\nالنتيجة النهائية\n--------------------\n${endMessage}\nإذن: صديقك هو الفائز 😔`;
    } else if (score1 < score2) {
        resultMessage1 = `--------------------\nالنتيجة النهائية\n--------------------\n${endMessage}\nإذن: صديقك هو الفائز 😔`;
        resultMessage2 = `--------------------\nالنتيجة النهائية\n--------------------\n${endMessage}\nإذن: انت الفائز 🥳!`;
    } else {
        resultMessage1 = resultMessage2 = `--------------------\nالنتيجة النهائية\n--------------------\n${endMessage}\nإذن: هناك تعادل بينكما😌!`;
    }

    setTimeout(() => {
        botly.sendText({
            id: player1,
            text: resultMessage1
        });
    }, 1500);

    setTimeout(() => {
        botly.sendText({
            id: player2,
            text: resultMessage2
            .replace('نقاطك: ' + score1, 'نقاطك: ' + score2)
            .replace('نقاط صديقك: ' + score2, 'نقاط صديقك: ' + score1)
        });
    }, 1500);

    setTimeout(() => {
showMainMenu(player1, 'يمكنك اعادة اللعب');
    }, 2100);

    setTimeout(() => {
showMainMenu(player2, 'يمكنك اعادة اللعب');
    }, 2100);
}

function invalidateInviteCode(sessionId) {
  const session = gameSessions[sessionId];
  if (session && session.player2 === null) {
    delete gameSessions[sessionId];
    setTimeout(() => {
 showMainMenu(session.player1, 'انتهت صلاحية كود الدعوة \n يمكنك اللعب مع البوت او مع صديق مجددا');
    }, 1000);
  }
}
function endGameDueToInactivity(senderId) {
  if (userBoards[senderId]) {
    botly.sendText({
      id: senderId,
      text: 'تم إنهاء الجلسة بسبب عدم النشاط لمدة 5 دقائق.'
    }, function() {
      setTimeout(() => {
        showMainMenu(senderId, 'يمكنك اعادة اللعب');
      }, 1000);
    });
    delete userBoards[senderId];
  }
}

//global game functions
function startGlobalMatch(senderId) {
    if (globalSearchingPlayers.has(senderId) || globalWaitingPlayers.includes(senderId)) {
/*
        botly.sendText({ 
            id: senderId, 
            text: "⚠️ أنت بالفعل في قائمة البحث عن لاعبين، يرجى الانتظار حتى يتم العثور على خصم." 
        });*/
        return;
    }
globalSearchingPlayers.add(senderId);
  setTimeout(() => {
      botly.sendText({
          id: senderId,
          text: "⏳ جاري البحث عن لاعبين...\nمدة البحث: 30 ثانية",
          quick_replies: [ 
              botly.createQuickReply('❌ إلغاء البحث', `CANCEL_GLOBAL_SEARCH_${senderId}`)
          ]
      });
  }, 1000);  

    setTimeout(() => {
        globalWaitingPlayers.push(senderId);

        if (globalWaitingPlayers.length >= 2) {
            let player1 = globalWaitingPlayers.shift();
            let player2 = globalWaitingPlayers.shift();
            globalSearchingPlayers.delete(player1);
            globalSearchingPlayers.delete(player2);
            startGlobalGame(player1, player2);
        } else {
            setTimeout(() => {
                let index = globalWaitingPlayers.indexOf(senderId);
                if (index !== -1) {
                    globalWaitingPlayers.splice(index, 1);
                    globalSearchingPlayers.delete(senderId);
                   showMainMenu(senderId, 'لا يوجد لاعب اخر في الوقت الحالي، اعد المحاولة لاحقا.');

                }
            }, 30000);
        }
    }, 4000);
}



function startGlobalGame(player1, player2) {
  let sessionId = `GLOBAL_${player1}_${player2}`;
  globalGameSessions[sessionId] = {
    player1,
    player2,
    board: initBoard(),
    currentPlayer: player1,
    timeout: setTimeout(() => invalidateGlobalSession(sessionId), 5 * 60 * 1000)
  };
  botly.sendText({ 
    id: player1, 
    text: `🎉 تم العثور على خصم!\nرمزك ❌ ورمز خصمك ⚪\n\n${printBoard(globalGameSessions[sessionId].board)}\nحان دورك! (اختر بين 1-9)` 
  });

  botly.sendText({ 
    id: player2, 
    text: `🎉 تم العثور على خصم!\nرمزك ⚪ ورمز خصمك ❌\n\n${printBoard(globalGameSessions[sessionId].board)}\nفي انتظار أن يلعب خصمك...` 
  });

}


function handleGlobalMove(sessionId, player, move) {
  if (!globalGameSessions[sessionId]) return;

  let session = globalGameSessions[sessionId];
  let board = session.board;
  let currentPlayerSymbol = player === session.player1 ? player1 : player2;

  if (!makeMove(board, move, currentPlayerSymbol)) {
    botly.sendText({ id: player, text: "المكان محدد مسبقًا، اختر مكانًا آخر!" });
    return;
  }
resetGlobalSessionTimeout(sessionId);
  let nextPlayer = player === session.player1 ? session.player2 : session.player1;
  let currentMoveText = `لقد اخترت المكان ${move}`;
  let friendMoveText = `خصمك اختار المكان ${move}`;
  if (checkWin(board, currentPlayerSymbol)) {
      botly.sendText({ 
          id: player, 
          text: `🎉 انت الفائز!\n${printBoard(board)}\n${getRandomMessage(winMessages)}` 
      });

      botly.sendText({ 
          id: nextPlayer, 
          text: `😔 انت الخاسر!\n${printBoard(board)}\n${getRandomMessage(loseMessages)}` 
      });

      setTimeout(() => showMainMenu(player, 'يمكنك إعادة اللعب'), 1500);
      setTimeout(() => showMainMenu(nextPlayer, 'يمكنك إعادة اللعب'), 1500);

      delete globalGameSessions[sessionId];
      return;
  }

  if (checkDraw(board)) {
    botly.sendText({ id: player, text: `😌 انتهت الجولة بالتعادل!\n${printBoard(board)}\nحاول ان تفوز المرة القادمة.`});
    botly.sendText({ id: nextPlayer, text: `😌 انتهت الجولة بالتعادل!\n${printBoard(board)}\nحاول ان تفوز المرة القادمة.`});

    setTimeout(() => showMainMenu(player, 'يمكنك إعادة اللعب'), 1500);
    setTimeout(() => showMainMenu(nextPlayer, 'يمكنك إعادة اللعب'), 1500);

    delete globalGameSessions[sessionId];
    return;
  }
  botly.sendText({ id: player, text: `${currentMoveText}\n${printBoard(board)}\nفي انتظار أن يلعب خصمك..` });
  botly.sendText({ id: nextPlayer, text: `${friendMoveText}\n${printBoard(board)}\nحان دورك! (اختر بين 1-9)` });
  session.currentPlayer = nextPlayer;
}



function invalidateGlobalSession(sessionId) {
  if (!globalGameSessions[sessionId]) return;
  let session = globalGameSessions[sessionId];
  delete globalGameSessions[sessionId];
  botly.sendText({ id: session.player1, text: "تم إنهاء اللعبة بسبب انكما لم تكملا اللعب." });
  botly.sendText({ id: session.player2, text: "تم إنهاء اللعبة بسبب انكما لم تكملا اللعب." });
  setTimeout(() => showMainMenu(session.player1, 'يمكنك إعادة اللعب'), 1500);
  setTimeout(() => showMainMenu(session.player2, 'يمكنك إعادة اللعب'), 1500);
}
function resetGlobalSessionTimeout(sessionId) {
    const session = globalGameSessions[sessionId];
    if (!session) return;

    if (session.timeout) {
        clearTimeout(session.timeout);
    }
    session.timeout = setTimeout(() => {       invalidateGlobalSession(sessionId);
    }, 5 * 60 * 1000); // 5 دقائق
}

//user in the game 
function isPlayerInGame(senderId) {
    return userBoards[senderId] || 
           Object.values(gameSessions).some(session => session.player1 === senderId || session.player2 === senderId) || 
           Object.values(globalGameSessions).some(session => session.player1 === senderId || session.player2 === senderId);
}

//End of code, made with love by MoroccoAI Team