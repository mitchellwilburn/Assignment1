const DEBANK_API_KEY = 'c11af67d8eba3fe52ddf4439fae670d601f71296';
const ETHERSCAN_API_KEY = 'F4Q13INNHJSXI11GRIRM8Z8U6EJVMAYJ9Y';

// Fetch total balances for wallets
function fetchTotalBalances() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Overview');
  const walletAddresses = [
    '0x5138a28d8c519c49b2be0b35282af340ab71ad2a',
    '0xb4ca6a300ef26440159f42b16639a4cfddd2e73b'
  ];

  sheet.clearContents();
  sheet.appendRow(['Wallet ID', 'Total Balance (USD)', 'Total Balance (ETH)']);

  walletAddresses.forEach((walletAddress, index) => {
    const totalBalance = getTotalBalance(walletAddress);
    sheet.getRange(index + 2, 1).setValue(walletAddress);
    sheet.getRange(index + 2, 2).setValue(totalBalance.usd);
    sheet.getRange(index + 2, 3).setValue(totalBalance.eth);
  });
}

// Get total balance for a specific wallet
function getTotalBalance(walletAddress) {
  const url = `https://pro-openapi.debank.com/v1/user/total_balance?id=${walletAddress}`;
  const options = {
    method: 'get',
    headers: {
      'Accept': 'application/json',
      'AccessKey': DEBANK_API_KEY
    }
  };

  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    return {
      usd: data.total_usd_value,
      eth: data.total_usd_value / getEthPrice()  // Calculate ETH value based on USD value and current ETH price
    };
  } catch (error) {
    Logger.log(`Error fetching total balance for ${walletAddress}: ${error}`);
    return { usd: 0, eth: 0 };
  }
}

// Fetch wallet data including NFTs
function fetchWalletData() {
  const walletAddresses = [
    '0x5138a28d8c519c49b2be0b35282af340ab71ad2a',
    '0xb4ca6a300ef26440159f42b16639a4cfddd2e73b'
  ];
  const chains = ['eth', 'blast', 'linea', 'arbitrum'];

  walletAddresses.forEach((walletAddress, index) => {
    const walletSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(`Wallet${index + 1}`);
    walletSheet.clearContents();
    walletSheet.appendRow(['Asset', 'Amount', 'Value (USD)', 'Value (ETH)', '% of Total']);

    let totalValueUSD = 0;
    let totalValueETH = 0;
    let assetMap = new Map();

    chains.forEach(chainId => {
      const url = `https://pro-openapi.debank.com/v1/user/all_token_list?id=${walletAddress}&chain_id=${chainId}`;
      const options = {
        method: 'get',
        headers: {
          'Accept': 'application/json',
          'AccessKey': DEBANK_API_KEY
        }
      };

      try {
        const response = UrlFetchApp.fetch(url, options);
        const data = JSON.parse(response.getContentText());

        data.forEach((token) => {
          const valueUSD = token.amount * token.price;
          if (valueUSD < 200) return; // Ignore assets below $200

          const valueETH = valueUSD / getEthPrice();
          totalValueUSD += valueUSD;
          totalValueETH += valueETH;

          if (assetMap.has(token.symbol)) {
            let existingToken = assetMap.get(token.symbol);
            existingToken.amount += token.amount;
            existingToken.valueUSD += valueUSD;
            existingToken.valueETH += valueETH;
          } else {
            assetMap.set(token.symbol, {
              symbol: token.symbol,
              amount: token.amount,
              valueUSD: valueUSD,
              valueETH: valueETH
            });
          }
        });
      } catch (error) {
        Logger.log(`Error fetching data for wallet ${walletAddress} on chain ${chainId}: ${error}`);
      }

      // Fetch NFTs
      const nftUrl = `https://pro-openapi.debank.com/v1/user/nft_list?id=${walletAddress}&chain_id=${chainId}`;
      try {
        const nftResponse = UrlFetchApp.fetch(nftUrl, options);
        const nftData = JSON.parse(nftResponse.getContentText());

        const nftSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('NFTs');
        nftSheet.appendRow(['Wallet ID', 'Chain', 'Name', 'Floor Price (ETH)', 'Refundable Price (ETH)', 'Higher Value (ETH)', 'Amount', 'Total Value (ETH)']);

        nftData.forEach(nft => {
          const name = nft.name || nft.contract_name;
          const floorPrice = nft.floor_price || 0;
          const refundablePrice = nft.refundable_price || 0;
          const higherValue = Math.max(floorPrice, refundablePrice);
          const amount = nft.amount || 1;
          const totalValue = higherValue * amount;

          if (totalValue >= 200) {
            nftSheet.appendRow([walletAddress, chainId, name, floorPrice, refundablePrice, higherValue, amount, totalValue]);
          }
        });
      } catch (error) {
        Logger.log(`Error fetching NFT data for wallet ${walletAddress} on chain ${chainId}: ${error}`);
      }
    });

    assetMap.forEach((token) => {
      walletSheet.appendRow([token.symbol, token.amount, token.valueUSD, token.valueETH]);
    });

    const rows = walletSheet.getDataRange().getValues();
    for (let i = 1; i < rows.length; i++) {
      const valueUSD = rows[i][2];
      const valueETH = rows[i][3];
      const percentTotalUSD = (valueUSD / totalValueUSD) * 100;
      const percentTotalETH = (valueETH / totalValueETH) * 100;

      walletSheet.getRange(i + 1, 5).setValue(`${percentTotalUSD.toFixed(2)}% / ${percentTotalETH.toFixed(2)}%`);
    }
  });
}

// Fetch ETH price from Etherscan
function getEthPrice() {
  const url = `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`;

  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    return parseFloat(data.result.ethusd);
  } catch (error) {
    Logger.log(`Error fetching ETH price: ${error}`);
    return 0;
  }
}

// Fetch the biggest movers in the last 24 hours
function fetchBiggestMovers() {
  const walletAddresses = [
    '0x5138a28d8c519c49b2be0b35282af340ab71ad2a',
    '0xb4ca6a300ef26440159f42b16639a4cfddd2e73b'
  ];
  const chains = ['eth', 'blast', 'linea', 'arbitrum'];
  const movers = [];

  walletAddresses.forEach((walletAddress) => {
    chains.forEach(chainId => {
      const url = `https://pro-openapi.debank.com/v1/user/all_token_list?id=${walletAddress}&chain_id=${chainId}`;
      const options = {
        method: 'get',
        headers: {
          'Accept': 'application/json',
          'AccessKey': DEBANK_API_KEY
        }
      };

      try {
        const response = UrlFetchApp.fetch(url, options);
        const data = JSON.parse(response.getContentText());
        data.forEach((token) => {
          const priceChange = token.price_24h_change;
          if (priceChange !== undefined && Math.abs(priceChange) > 0) {
            movers.push({ symbol: token.symbol, change: priceChange });
          }
        });
      } catch (error) {
        Logger.log(`Error fetching biggest movers for ${walletAddress} on chain ${chainId}: ${error}`);
      }
    });
  });

  movers.sort((a, b) => Math.abs(b.change) - Math.abs(a.change));

  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('BiggestMovers');
  sheet.clearContents();
  sheet.appendRow(['Asset', '24h Change (%)']);

  movers.slice(0, 10).forEach((mover) => {
    sheet.appendRow([mover.symbol, (mover.change * 100).toFixed(2)]);
  });
}

// Update all data
function updateAllData() {
  fetchTotalBalances();
  fetchWalletData();
  fetchBiggestMovers();
}
