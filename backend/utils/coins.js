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

function applyHostellerTopUp(balanceAfterSpend) {
  const numericBalance = Number(balanceAfterSpend || 0);
  if (numericBalance === 0) {
    return {
      finalBalance: 500,
      topUpAdded: 500
    };
  }

  return {
    finalBalance: numericBalance,
    topUpAdded: 0
  };
}

module.exports = {
  computeDeliveryPayout,
  computeFiveStarReward,
  applyHostellerTopUp
};
