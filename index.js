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

function startGame(senderId, level) {
  userBoards[senderId] = initBoard();
  userBoards[senderId].level = level; // تخزين مستوى الصعوبة

  setTimeout(() => {
    botly.sendText({
      id: senderId,
      text: `رمزك ${player1} و رمزي ${computer}\n${printBoard(userBoards[senderId])}\nانت أولا! (اختر بين 1-9)`
    });
  }, 1000);
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

function easyComputerMove(board, player1Move) {
  const emptyPositions = board
    .map((value, index) => (value !== ` ${player1}` && value !== ` ${computer}` ? index + 1 : null))
    .filter(value => value !== null);

  if (emptyPositions.length === 0) return null;

  return emptyPositions[Math.floor(Math.random() * emptyPositions.length)];
}

function mediumComputerMove(board, player1Move) {
  return computerMove(board, player1Move); // استخدم دالة الكمبيوتر الحالية
}

function hardComputerMove(board, player1Move) {
  return minimax(board, computer).index;
}

function minimax(newBoard, player) {
  const availSpots = newBoard.filter(s => !s.includes(player1) && !s.includes(computer));

  if (checkWin(newBoard, player1)) {
    return { score: -10 };
  } else if (checkWin(newBoard, computer)) {
    return { score: 10 };
  } else if (availSpots.length === 0) {
    return { score: 0 };
  }

  const moves = [];

  for (let i = 0; i < availSpots.length; i++) {
    const move = {};
    move.index = newBoard[availSpots[i]]; // حفظ الموقع الحالي
    newBoard[availSpots[i]] = ` ${player}`; // إجراء الحركة

    if (player === computer) {
      const result = minimax(newBoard, player1);
      move.score = result.score;
    } else {
      const result = minimax(newBoard, computer);
      move.score = result.score;
    }

    newBoard[availSpots[i]] = move.index; // إعادة تعيين الموقع
    moves.push(move);
  }

  let bestMove;
  if (player === computer) {
    let bestScore = -Infinity;
    for (let i = 0; i < moves.length; i++) {
      if (moves[i].score > bestScore) {
        bestScore = moves[i].score;
        bestMove = i;
      }
    }
  } else {
    let bestScore = Infinity;
    for (let i = 0; i < moves.length; i++) {
      if (moves[i].score < bestScore) {
        bestScore = moves[i].score;
        bestMove = i;
      }
    }
  }

  return moves[bestMove];
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





// وظيفة لإنشاء جلسة لعبة متعددة اللاعبين
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
        text: `ارسل هذا الكود الى صديقك، وقل له ان يرسله لي لكي تلعب معه مباشرة\nارسل له رابط الصفحة لكي يراسلني \n\nتنتهي مدة صلاحية الدعوة بعد 5 دقائق او يمكنك إنهاء الدعوة عبر الزر`
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

// تعديل في وظيفة handleMultiplayerMove للتعامل مع الجولات المتعددة
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
     //     setTimeout(() => {
            botly.sendText({
                id: session.player1,
                text: `انتهت الجولة ${session.currentRound}!\n${currentPlayer === player1 ? 'انت الفائز فيها 🥳!' : 'صديقك الفائز فيها 🥳!'}\n${printBoard(board)}\n------------\nنقاطك: ${session.scores.player1}, نقاط صديقك: ${session.scores.player2}\n`
            });
    //      }, 1000);
         // setTimeout(() => {
            botly.sendText({
                id: session.player2,
                text: `انتهت الجولة ${session.currentRound}!\n${currentPlayer === player1 ? 'صديقك الفائز فيها 🥳!' : 'انت الفائز فيها 🥳!'}\n${printBoard(board)}\n------------\nنقاطك: ${session.scores.player2}, نقاط صديقك: ${session.scores.player1}\n`
            });
        //  }, 1000);
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
        });
    }, 1500);

    setTimeout(() => {
        botly.sendText({
            id: player1,
            text: 'يمكنك إعادة اللعب',
            quick_replies: [
                botly.createQuickReply('اللعب مع البوت', 'RESTART'),
                botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
            ]
        });
    }, 2000);

    setTimeout(() => {
        botly.sendText({
            id: player2,
            text: 'يمكنك إعادة اللعب',
            quick_replies: [
                botly.createQuickReply('اللعب مع البوت', 'RESTART'),
                botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
            ]
        });
    }, 2000);
}


function invalidateInviteCode(sessionId) {
  const session = gameSessions[sessionId];
  if (session && session.player2 === null) {
    delete gameSessions[sessionId];
    setTimeout(() => {
   botly.sendText({
        id: session.player1,
        text: 'انتهت صلاحية كود الدعوة \n يمكنك اللعب مع البوت او مع صديق مجددا',
        quick_replies: [
          botly.createQuickReply('اللعب مع البوت', 'RESTART'),
          botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
        ]
      });
    }, 1000);
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
        botly.sendText({
          id: senderId,
          text: 'اختر مستوى الصعوبة',
          quick_replies: [
            botly.createQuickReply('سهل', 'EASY_LEVEL'),
            botly.createQuickReply('متوسط', 'MEDIUM_LEVEL'),
            botly.createQuickReply('صعب', 'HARD_LEVEL')
          ]
        });
      } else if (postback == "EASY_LEVEL") {
        startGame(senderId, 'easy');
      } else if (postback == "MEDIUM_LEVEL") {
        startGame(senderId, 'medium');
      } else if (postback == "HARD_LEVEL") {
        startGame(senderId, 'hard');
      }  else if (postback == "INVITE_FRIEND") {
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
          botly.sendText({
            id: senderId,
            text: 'مرحبا بك في لعبة tic tac toe! \n يمكنك الاختيار بين اللعب مع البوت ام اللعب مع صديق',
            quick_replies: [
              botly.createQuickReply('اللعب مع البوت', 'RESTART'),
              botly.createQuickReply('اللعب مع صديق', 'INVITE_FRIEND')
            ]
          });
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
        text: "tic tac toe"
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
 console.log(`Server running on port ${port}`);
                               });