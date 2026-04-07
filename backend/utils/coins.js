function computeDeliveryPayout(totalNestCoins) {
  const total = Number(totalNestCoins || 0);
  const cookShare = Math.round(total * 0.7);
  const deliveryShare = total - cookShare;

  return {
    cookShare,
    deliveryShare
  };
}

function computeFiveStarReward(totalNestCoins) {
  const share = Math.floor(Number(totalNestCoins || 0) / 3);
  return {
    studentShare: share,
    cookShare: share,
    deliveryShare: share
  };
}

module.exports = {
  computeDeliveryPayout,
  computeFiveStarReward
};
