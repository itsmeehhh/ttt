import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
import Botly from 'botly';
dotenv.config();

const app = express();
const PageID = "359211540615525";
let userBoards = {};
let gameSessions = {};
const player1 = '❌';
const player2 = '⚪';
const computer = '⚪'; 
/*--------- page database ---------*/ 
const botly = new Botly({
  accessToken: 'EAAVL9kMAiqQBOZCtedZAQilTs7xZChDVKEEVpQN5eidOitEIEl25cbfC2yn3dN2KcEZC89xMTOGS679OOzHqZB0YYqpDvVmKjFILmNJvJs2WWZCIVgkUAqhO4eZBSvAaYXtZB8WSkYGj6dMkysBVOkueSEzPuIA3k5aFRP4mZAB2R2UT57uKkYWRGu5yntwrP9uenZBQZDZD',
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
    verify: botly.getVerifySignature('d697b070c3c06ef0a2923276dd69c0b7'),
  })
);
app.use(bodyParser.urlencoded({ extended: false }));
app.use("/webhook", botly.router());
let awaitingInviteCode = {};
/*--------- Messages ---------*/
      botly.on("message", async (senderId, message, data) => {
     botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.MARK_SEEN});
                                 botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_ON});

 if (message.message.text) {
   if (message.message.text == '.rest'){
     delete userBoards[senderId];
     showMainMenu(senderId, 'تم حذف سجل اللعبة');
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
                text: `قمت بالانضمام الى اللعبة عبر كود الدعوة!\n يمكنك اللعب مع صديقك الان\nرمزك هو ${player2} و رمز صديقك ${player1}`
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
            botly.sendText({
              id: senderId,
              text: 'مرحبا بك في لعبة tic tac toe! \n يمكنك الاختيار بين اللعب مع البوت ام اللعب مع صديق'
            });
            setTimeout(() => {
              showMainMenu(senderId, 'ماذا اريد ؟');
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
        botly.sendText({
          id: senderId,
          text: 'مرحبا بك في لعبة tic tac toe! \n يمكنك الاختيار بين اللعب مع البوت ام اللعب مع صديق'
                 });
        setTimeout(() => {
        showMainMenu(senderId, 'ماذا اريد ؟');
        }, 1000);
         } if (postback == "BOT_FIRST") {
    if (userBoards[senderId]) {
      // البوت يلعب أولاً (يختار المركز - المكان 5)
      makeMove(userBoards[senderId], 5, computer);
setTimeout(() => {
      botly.sendText({
        id: senderId,
        text: `لقد لعبت أولاً واخترت المكان 5!\n${printBoard(userBoards[senderId])}\nحان دورك! (اختر بين 1-9)`
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
            botly.createQuickReply('سهل', 'EASY_LEVEL'),
            botly.createQuickReply('متوسط', 'MEDIUM_LEVEL'),
            botly.createQuickReply('صعب', 'HARD_LEVEL'),
             botly.createQuickReply('رجوع', 'BACK_TO_HOME')
          ]
        });
        }, 1000);
      } else if (postback == "EASY_LEVEL") {
        startGame(senderId, 'easy');
      } else if (postback == "MEDIUM_LEVEL") {
        startGame(senderId, 'medium');
      } else if (postback == "HARD_LEVEL") {
        setTimeout(() => {
          botly.sendText({
              id: senderId,
              text: `أعدك انك لن تهزمني أبدا 😂🤦🏻‍♂️`
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
                     botly.createQuickReply('5 جولات', 'INVITE_FIVE_ROUNDS'),
                   botly.createQuickReply('10 جولات', 'INVITE_TEN_ROUNDS'),
                   botly.createQuickReply('رجوع', 'BACK_TO_HOME')
                 ]
             });
  }, 1000);
          } else if (postback.startsWith("CANCEL_INVITE_")) {
            const inviteCode = postback.split("CANCEL_INVITE_")[1];
            invalidateInviteCode(inviteCode);
          } else if (postback == "INVITE_SINGLE_ROUND") {
            initiateMultiplayerGame(senderId, 1);
          } else if (postback == "INVITE_FIVE_ROUNDS") {
            initiateMultiplayerGame(senderId, 5);
          } else if (postback == "INVITE_TEN_ROUNDS") {
        initiateMultiplayerGame(senderId, 10);
      } else if (postback == "BACK_TO_HOME") {
        setTimeout(() => {
showMainMenu(senderId, 'مرحبا بك في لعبة tic tac toe! \nيمكنك الاختيار بين اللعب مع البوت ام اللعب مع صديق ');
        }, 1000); 
           } else if (postback == "ENTER_INVITE_CODE") {
     awaitingInviteCode[senderId] = true;
   setTimeout(() => {
     botly.sendText({
       id: senderId,
       text: 'ادخل كود الدعوة الذي ارسله لك صديقك',
       quick_replies: [botly.createQuickReply('الغاء الادخال', 'CANCEL_ENTER_INVITE_CODE')]
     });
   }, 1000);
   } else if (postback == "CANCEL_ENTER_INVITE_CODE") {
     delete awaitingInviteCode[senderId];
     setTimeout(() => {
       showMainMenu(senderId, 'مرحبا بك في لعبة tic tac toe! \nيمكنك الاختيار بين اللعب مع البوت ام اللعب مع صديق ');
     }, 1000);
   }


botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_OFF});
                               });
     botly.setGetStarted({pageId: PageID, payload: "GET_STARTED"});
      botly.setGreetingText({
      pageId: PageID,
     greeting: [
       {
        locale: "default",
        text: "           tic tac toe \n اول لعبة متكاملة على الفيسبوك صنعت من طرف فريق\nMoroccoAI"
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
const port = 8080;
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
      botly.createQuickReply('ادخال كود الدعوة', 'ENTER_INVITE_CODE')
    ]
  });
}

function initBoard() {
  return ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣'];
}

function printBoard(board) {
  return `
    ${board[0]} | ${board[1]} | ${board[2]}
    ---------------------
    ${board[3]} | ${board[4]} | ${board[5]}
    ---------------------
    ${board[6]} | ${board[7]} | ${board[8]}
  `;
}

// التعامل مع اللعب مع الكمبيوتر والمستويات
function startGame(senderId, level) {
  userBoards[senderId] = initBoard();
  userBoards[senderId].level = level;

  // إضافة مهلة (timeout) لمدة 5 دقائق
  userBoards[senderId].timeout = setTimeout(() => {
    endGameDueToInactivity(senderId);
  }, 5 * 60 * 1000); // 5 دقائق

  setTimeout(() => {
    botly.sendText({
      id: senderId,
      text: `رمزك ${player1} و رمزي ${computer}\n${printBoard(userBoards[senderId])}\nانت أولا! (اختر بين 1-9)`,
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
  botly.sendText({
    id: senderId,
    text: `انتهت اللعبة 😉\n${printBoard(userBoards[senderId])}\n${message}`
  }, function() {
    setTimeout(() => {
      showMainMenu(senderId, 'يمكنك اعادة اللعب');
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

  // إعادة تعيين المهلة (timeout) عند كل حركة
  if (board.timeout) {
    clearTimeout(board.timeout);
  }
  board.timeout = setTimeout(() => {
    endGameDueToInactivity(senderId);
  }, 5 * 60 * 1000); // 5 دقائق

  if (makeMove(board, move, player1)) {
    if (checkWin(board, player1)) {
      endGame(senderId, 'هزمتني 🙄، المرة القادمة سأهزمك😏!');
      return;
    } else if (checkDraw(board)) {
      endGame(senderId, "تعادل 😂، لعبة جيدة لنعدها ❤️");
      return;
    }

    let computerMovePosition;
    if (board.level === 'easy') {
      computerMovePosition = easyComputerMove(board, move);
    } else if (board.level === 'medium') {
      computerMovePosition = mediumComputerMove(board, move);
    } else if (board.level === 'hard') {
      computerMovePosition = hardComputerMove(board, move);
    }

    if (computerMovePosition) {
      makeMove(board, computerMovePosition, computer);
      if (checkWin(board, computer)) {
        endGame(senderId, 'هزمتك 😂، حاول المرة القادمة ان تهزمني😉');
      } else if (checkDraw(board)) {
        endGame(senderId, "تعادل 😂، لعبة جيدة لنعدها ❤️");
      } else {
        botly.sendText({
          id: senderId,
          text: `سأختار المكان ${computerMovePosition}\n${printBoard(board)}\nحان دورك! (إختر بين 1 إلى 9)`
        });
      }
    } else {
      delete userBoards[senderId];
      showMainMenu(senderId, 'حدث لي خطأ، يمكنك اعادة اللعب من جديد');
    }
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
        } else if (checkDraw(board)) {
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
//End of code, made with love by MoroccoAI Team
