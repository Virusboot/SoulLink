// src/services/game.service.js
const prisma = require('../config/db');

const TRUTHS = [
  "What's your biggest fear?",
  "Who was your first crush?",
  "What's the most embarrassing thing you've done?",
  "What's a secret you've never told anyone?",
];
const DARES = [
  "Sing the first line of your favorite song",
  "Do your best dance move",
  "Say something nice about the other person",
  "Tell a joke",
];
const WOULD_YOU_RATHER = [
  { a: "Live without music", b: "Live without TV" },
  { a: "Be always cold", b: "Be always hot" },
  { a: "Fly", b: "Be invisible" },
];

const createGame = async (type, participantIds) => {
  return prisma.game.create({
    data: {
      type, status: 'ACTIVE',
      currentTurn: participantIds[0],
      state: JSON.stringify({ round: 0 }),
      participants: { create: participantIds.map(uid => ({ userId: uid })) },
    },
    include: { participants: true },
  });
};

const nextTurn = async (gameId, userId, action, participantIds) => {
  const game  = await prisma.game.findUnique({ where: { id: gameId } });
  if (!game) throw new Error('Game not found');
  const state = JSON.parse(game.state);
  const next  = participantIds.find(id => id !== userId) || participantIds[0];
  let nextQuestion = null;

  if (game.type === 'truth_or_dare') {
    nextQuestion = action === 'truth'
      ? TRUTHS[Math.floor(Math.random() * TRUTHS.length)]
      : DARES[Math.floor(Math.random() * DARES.length)];
    state.mode = action;
  } else if (game.type === 'would_you_rather') {
    state.round++;
    nextQuestion = WOULD_YOU_RATHER[state.round % WOULD_YOU_RATHER.length];
    if (action) state.choices = { ...(state.choices || {}), [userId]: action };
  }

  state.round = (state.round || 0) + 1;
  state.currentQuestion = nextQuestion;

  const updated = await prisma.game.update({
    where: { id: gameId },
    data:  { currentTurn: next, state: JSON.stringify(state) },
  });
  return { game: updated, state, nextQuestion };
};

const endGame = async (gameId, winnerId = null) =>
  prisma.game.update({ where: { id: gameId }, data: { status: 'FINISHED', winnerId } });

module.exports = { createGame, nextTurn, endGame };
