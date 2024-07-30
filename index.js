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
  accessToken: 'EAAVL9kMAiqQBOzXPhCfYdfrSSC1NnKhsZC6tHCEOMMQUJ2MieQClVx5Or7mDSJbbSjSz3rjI9X8sbgncUFdiZCIOcZCTiOaZCcNluU2FYoNwp0V5fqZBPoBdOZB3lYZAcDFGZBOrNc05Ktb9oW8vsJWElQAH6pBsLJtzIl8z20x6z5g08lLE50UPBRy3YiyqWhrNbgZDZD',
  verifyToken: '12345678',
  webHookPath: process.env.WB_PATH,
  notificationType: Botly.CONST.REGULAR,
  FB_URL: "https://graph.facebook.com/v18.0/",
});

/*--------- Functions ---------*/
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

function generateInviteCode() {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'MOROCCOAI';
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
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

function startGame(senderId) {
  userBoards[senderId] = initBoard();
  botly.sendText({
    id: senderId,
    text: `رمزك ${player1} و رمزي ${computer}\n${printBoard(userBoards[senderId])}\nانت أولا! (اختر بين 1-9)`
  });
}

function endGame(senderId, message) {
  botly.sendText({
    id: senderId,
    text: `انتهت اللعبة 😉\n${printBoard(userBoards[senderId])}\n${message}`
  }, function() {
    setTimeout(() => {
      botly.sendText({
        id: senderId,
        text: 'يمكنك اعادة اللعب',
        quick_replies: [
          botly.createQuickReply('اللعب مع البوت', 'RESTART'),
          botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
        ]
      });
    }, 1000); 
  });
  delete userBoards[senderId];
}

function computerMove(board, player1Move) {
  const emptyPositions = board
    .map((value, index) => (value !== ` ${player1}` && value !== ` ${computer}` ? index + 1 : null))
    .filter(value => value !== null);

  if (emptyPositions.length === 0) return null;

  const winningMove = emptyPositions.find(position => {
    const testBoard = [...board];
    makeMove(testBoard, position, computer);
    const win = checkWin(testBoard, computer);
    return win;
  });

  if (winningMove) return winningMove;

  const blockingMove = emptyPositions.find(position => {
    const testBoard = [...board];
    makeMove(testBoard, position, player1);
    const block = checkWin(testBoard, player1);
    return block;
  });

  if (blockingMove) return blockingMove;


  const strategicMove = findStrategicMove(board, emptyPositions);
  if (strategicMove) return strategicMove;

  return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
}


function findStrategicMove(board, emptyPositions) {
  const cornerPositions = [1, 3, 7, 9];
  const edgePositions = [2, 4, 6, 8];


  if (emptyPositions.includes(5)) return 5;

  const preferredCorners = emptyPositions.filter(pos => cornerPositions.includes(pos));
  if (preferredCorners.length > 0) return preferredCorners[0];

  const preferredEdges = emptyPositions.filter(pos => edgePositions.includes(pos));
  if (preferredEdges.length > 0) return preferredEdges[0];

  return null;
}



function handlePlayerMove(senderId, move) {
  let board = userBoards[senderId];
  if (makeMove(board, move, player1)) {
    if (checkWin(board, player1)) {
      endGame(senderId, 'هزمتني 🙄، المرة القادمة سأهزمك😏!');
      return;
    } else if (checkDraw(board)) {
      endGame(senderId, "تعادل 😂، لعبة جيدة لنعدها ❤️");
      return;
    }

    let computerMovePosition = computerMove(board, move);
    if (computerMovePosition) {
      makeMove(board, computerMovePosition, computer);
      if (checkWin(board, computer)) {
        endGame(senderId, 'هزمتك 😂، حاول المرة القادمة ان تهزمني😉');
      } else if (checkDraw(board)) {
        endGame(senderId, "تعادل 😂، لعبة جيدة لنعدها ❤️");
      } else {
        botly.sendText({
          id: senderId,
          text: `سأختار المكان ${computerMovePosition}\n${printBoard(board)}\nحان دورك! (إختر بين 1-9)`
        });
      }
    } else {
      botly.sendText({
        id: senderId,
        text: 'حدث لي خطأ بحيث لم اتمكن من اختيار مكان 🥺'
      });
    }
  } else {
    botly.sendText({
      id: senderId,
      text: 'المكان محدد مسبقا, حاول تحديد مكان اخر! (إختر بين 1-9)'
    });
  }
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
        botly.sendText({
          id: session.player1,
          text: 'يمكنك إعادة اللعب',
          quick_replies: [
            botly.createQuickReply('اللعب مع البوت', 'RESTART'),
            botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
          ]
        });
      }, 1000);
    });

    botly.sendText({
      id: session.player2,
      text: 'تم انهاء اللعبة بسبب انكما لم تكملا اللعب 😐'
    }, function() {
      setTimeout(() => {
        botly.sendText({
          id: session.player2,
          text: 'يمكنك إعادة اللعب',
          quick_replies: [
            botly.createQuickReply('اللعب مع البوت', 'RESTART'),
            botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
          ]
        });
      }, 1000);
    });
  }
}

function resetMultiplayerSessionTimeout(sessionId) {
  const session = gameSessions[sessionId];
  if (session.timeout) {
    clearTimeout(session.timeout);
  }
  session.timeout = setTimeout(() => {
    invalidateMultiplayerSession(sessionId);
  }, 5 * 60 * 1000); // 5 دقائق
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
      botly.sendText({
        id: session.player1,
        text: `اووه كانت لعبة جيدة بينكما 😉\n${printBoard(board)}\n${currentPlayer === player1 ? 'انت الفائز 🥳!' : 'صديقك الفائز 🥳!'}`
      });
      botly.sendText({
        id: session.player2,
        text: `اووه كانت لعبة جيدة بينكما 😉\n${printBoard(board)}\n${currentPlayer === player1 ? 'صديقك الفائز 🥳!' : 'انت الفائز 🥳!'}`
      });
  endMultiplayerGame(sessionId);
    } else if (checkDraw(board)) {
      botly.sendText({
        id: session.player1,
        text: `اووه كانت لعبة جيدة بينكما 😉\n${printBoard(board)}\nتعادل 😂!`
      });
      botly.sendText({
        id: session.player2,
        text: `اووه كانت لعبة جيدة بينكما 😉\n${printBoard(board)}\nتعادل 😂!`
      });
      endMultiplayerGame(sessionId);
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


function endMultiplayerGame(sessionId) {
  const session = gameSessions[sessionId];
  delete gameSessions[sessionId];
  setTimeout(() => {
    botly.sendText({
      id: session.player1,
      text: 'إنتهت اللعبة، يمكنك بدأ لعبة جديدة عبر اختيار احد الازرار',
      quick_replies: [
        botly.createQuickReply('اللعب مع البوت', 'RESTART'),
        botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
      ]
    });
    botly.sendText({
      id: session.player2,
      text: 'إنتهت اللعبة، يمكنك بدأ لعبة جديدة عبر اختيار احد الازرار',
      quick_replies: [
        botly.createQuickReply('اللعب مع البوت', 'RESTART'),
        botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
                                     ]
                                   });
                                 }, 1000);
 }
function invalidateInviteCode(sessionId) {
  const session = gameSessions[sessionId];
  if (session && session.player2 === null) {
    delete gameSessions[sessionId];
   botly.sendText({
        id: session.player1,
        text: 'انتهت صلاحية كود الدعوة \n يمكنك اللعب مع البوت او مع صديق مجددا',
        quick_replies: [
          botly.createQuickReply('اللعب مع البوت', 'RESTART'),
          botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
        ]
      });
  }
}

      botly.on("message", async (senderId, message, data) => {
     botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.MARK_SEEN});
                                 botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_ON});

     if (message.message.text) {
     const text = message.message.text.trim();
     if (userBoards[senderId]) {
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
  //
       if (session.player2 === null) {
         botly.sendText({
           id: senderId,
           text: 'لا ترسل شيء حتى يدخل صديقك 😠\n ارسل له كود الدعوة لكي ينضم للعبة\n او يمكنك الغاء الدعوة',
           quick_replies: [botly.createQuickReply('إلغاء الدعوة', `CANCEL_INVITE_${inviteCode}`)]
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
    } else if (text.startsWith("MOROCCOAI") && text.length === 17) {

                                     // Handle invite code
       const sessionId = Object.keys(gameSessions).find(id => gameSessions[id].inviteCode === text && gameSessions[id].player2 === null);
       if (sessionId) {
           gameSessions[sessionId].player2 = senderId;
           resetMultiplayerSessionTimeout(sessionId);

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
           botly.sendText({
               id: senderId,
               text: 'كود الدعوة غير صالح.'
           });
       }

          } else {
     botly.sendText({
      id: senderId,
      text: 'مرحبا بك في لعبة tic tac toe! \n يمكنك الاختيار بين اللعب مع البوت ام اللعب مع صديق'
             });
 setTimeout(() => {
                    botly.sendText({
                id: senderId,
                text: 'ماذا تريد?',
                quick_replies: [
                botly.createQuickReply('اللعب مع البوت', 'RESTART'),
               botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
                          ]
                      });}, 1000)
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

        botly.on("postback", async (senderId, message, postback, data, ref) => {
       botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.MARK_SEEN});
       botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_ON});

      if (postback == "GET_STARTED") {
       botly.sendGeneric({id: senderId, elements: {
              title: "tic tac toe",
              image_url: "https://telegra.ph/file/77edfdf7b35823caf90f6.jpg",
              subtitle: "tic tac toe",
              buttons: [
              botly.createQuickReply("مطور البوت 🇲🇦😄", "Owner"),
                    ]}, aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL});

               setTimeout(() => {
                                  botly.sendText({
         id: senderId,
         text: 'مرحبا بك في لعبة tic tac toe! \nيمكنك الاختيار بين اللعب مع البوت ام اللعب مع صديق ',
                              quick_replies: [
                              botly.createQuickReply('اللعب مع البوت', 'RESTART'),
                             botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
                                        ]
                                    });}, 1000)
         } else if (postback == "Owner") {
          botly.sendGeneric({id: senderId, elements: {
                      title: "Morocco AI",
                      image_url: "https://telegra.ph/file/6db48bb667028c068d85a.jpg",
                     subtitle: " اضغط لمتابعة الصفحة ❤️👇🏻",
                    buttons: [
                    botly.createWebURLButton("صفحة المطور 🇲🇦😄", "https://www.facebook.com/profile.php?id=100090780515885")]},
            aspectRatio: Botly.CONST.IMAGE_ASPECT_RATIO.HORIZONTAL});
         } else if (postback == "RESTART") {
                    startGame(senderId);
         } else if (postback == "INVITE_FRIEND") {
            const inviteCode = generateInviteCode();
            gameSessions[inviteCode] = {
              player1: senderId,
              player2: null,
              board: initBoard(),
              currentPlayer: senderId,
              inviteCode: inviteCode
            };
            botly.sendText({
              id: senderId,
              text: `ارسل هذا الكود الى صديقك، وقل له ان يرسله لي لكي تلعب معه مباشرة\nارسل له رابط الصفحة لكي يراسلني \n\nتنتهي مدة صلاحية الدعوة بعد 5 دقائق`
            });
            setTimeout(() => {
              botly.sendText({
                id: senderId,
                text: `${inviteCode}`,
                quick_replies: [botly.createQuickReply('إلغاء الدعوة', `CANCEL_INVITE_${inviteCode}`)]
              });
            }, 1000);
            setTimeout(() => {
              invalidateInviteCode(inviteCode);
            }, 5 * 60 * 1000);
          } else if (postback.startsWith("CANCEL_INVITE_")) {
            const inviteCode = postback.split("CANCEL_INVITE_")[1];
            invalidateInviteCode(inviteCode);
          }

      botly.sendAction({id: senderId, action: Botly.CONST.ACTION_TYPES.TYPING_OFF});
                               });

      botly.setGetStarted({pageId: PageID, payload: "GET_STARTED"});
      botly.setGreetingText({
      pageId: PageID,
     greeting: [
                 {
                 locale: "default",
                 text: "tic tac toe"
                            }
                                 ]
                               });
      botly.setPersistentMenu({
                 pageId: PageID,
                 menu: [
                         {
                locale: "default",
                composer_input_disabled: false,
                call_to_actions: [
                                       {
        type:  "web_url",
        title: "صفحة المطور 🇲🇦😄",
        url:   "fb.com/Morocco.Openai/",
       webview_height_ratio: "full"
            }
       ]
    }
     ]
    });

  const port = 8080;

 app.listen(port, () => {
 console.log(`Server running on port ${port}`);
                               });