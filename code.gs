const DEBANK_API_KEY = 'c11af67d8eba3fe52ddf4439fae670d601f71296';
const ETHERSCAN_API_KEY = 'F4Q13INNHJSXI11GRIRM8Z8U6EJVMAYJ9Y';
let ethPrice = 0;

function fetchRawData() {
  fetchRawDataTokens();
  fetchRawDataNFTs();
}

function fetchRawDataTokens() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RawDataTokens');
  const walletAddresses = [
    '0x5138a28d8c519c49b2be0b35282af340ab71ad2a',
    '0xb4ca6a300ef26440159f42b16639a4cfddd2e73b'
  ];
  const chains = ['eth', 'blast', 'linea', 'arbitrum'];

  ethPrice = getEthPrice();
  Logger.log(`ETH Price: ${ethPrice}`);

  if (!sheet) {
    Logger.log("Sheet 'RawDataTokens' not found.");
    return;
  }

  sheet.clearContents();
  sheet.appendRow(['Wallet Address', 'Asset Name', 'Chain Name', 'Amount', 'Value (USD)', 'Value (ETH)', '24h Change (%)']);

  walletAddresses.forEach(walletAddress => {
    const countedProtocols = new Set();
    chains.forEach(chainId => {
      fetchTokens(walletAddress, chainId, sheet);
      fetchProtocols(walletAddress, chainId, sheet, countedProtocols);
    });
  });
}

function fetchTokens(walletAddress, chainId, sheet) {
  const url = `https://pro-openapi.debank.com/v1/user/token_list?id=${walletAddress}&chain_id=${chainId}`;
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
    Logger.log(`Token Data for wallet ${walletAddress} on chain ${chainId}: ${JSON.stringify(data)}`);

    data.forEach((token) => {
      const valueUSD = token.amount * token.price;
      if (valueUSD < 200) return; // Ignore assets below $200

      const valueETH = valueUSD / ethPrice;
      const change24h = token.price_24h_change * 100; // Convert to percentage
      sheet.appendRow([walletAddress, token.symbol, chainId, token.amount, valueUSD, valueETH, change24h.toFixed(2)]);
    });

  } catch (error) {
    Logger.log(`Error fetching tokens for wallet ${walletAddress} on chain ${chainId}: ${error.message}`);
  }
}

function fetchProtocols(walletAddress, chainId, sheet, countedProtocols) {
  const url = `https://pro-openapi.debank.com/v1/user/all_simple_protocol_list?id=${walletAddress}&chain_id=${chainId}`;
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
    Logger.log(`Protocol List for wallet ${walletAddress} on chain ${chainId}: ${JSON.stringify(data)}`);

    data.forEach(protocol => {
      if (!countedProtocols.has(protocol.id)) {
        countedProtocols.add(protocol.id);
        fetchProtocolBalances(walletAddress, chainId, protocol.id, sheet);
      }
    });
  } catch (error) {
    Logger.log(`Error fetching protocol list for wallet ${walletAddress} on chain ${chainId}: ${error.message}`);
  }
}

function fetchProtocolBalances(walletAddress, chainId, protocolId, sheet) {
  const url = `https://pro-openapi.debank.com/v1/user/protocol?id=${walletAddress}&protocol_id=${protocolId}&chain_id=${chainId}`;
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
    Logger.log(`Protocol Data for wallet ${walletAddress} on protocol ${protocolId} and chain ${chainId}: ${JSON.stringify(data)}`);

    if (data && data.portfolio_item_list && data.portfolio_item_list.length > 0) {
      data.portfolio_item_list.forEach((item) => {
        const assetValueUSD = item.stats.asset_usd_value;
        const liabilityValueUSD = item.stats.debt_usd_value || 0;  // Add liability value if it exists
        const netValueUSD = assetValueUSD - liabilityValueUSD;
        if (netValueUSD < 200) return; // Ignore assets below $200

        const netValueETH = netValueUSD / ethPrice;
        const change24h = item.stats.price_24h_change * 100; // Convert to percentage
        const assetName = `${item.name} (${protocolId})`;
        sheet.appendRow([walletAddress, assetName, chainId, item.stats.asset_amount, netValueUSD, netValueETH, change24h.toFixed(2)]);
      });
    } else {
      Logger.log(`No portfolio items found for wallet ${walletAddress} on protocol ${protocolId} and chain ${chainId}`);
    }
  } catch (error) {
    Logger.log(`Error fetching protocol balances for wallet ${walletAddress} and protocol ${protocolId} on chain ${chainId}: ${error.message}`);
  }
}

function fetchRawDataNFTs() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('RawDataNFTs');
  const walletAddresses = [
    '0x5138a28d8c519c49b2be0b35282af340ab71ad2a',
    '0xb4ca6a300ef26440159f42b16639a4cfddd2e73b'
  ];
  const chains = ['eth', 'blast', 'linea', 'arbitrum'];

  if (!ethPrice) {
    ethPrice = getEthPrice();
  }
  Logger.log(`ETH Price: ${ethPrice}`);

  if (!sheet) {
    Logger.log("Sheet 'RawDataNFTs' not found.");
    return;
  }

  sheet.clearContents();
  sheet.appendRow(['Wallet Address', 'NFT Name', 'Contract Name', 'Chain Name', 'Value (ETH)', 'Value (USD)', 'Refund Value (ETH)', 'Floor Price (ETH)', 'Last Trade Price (USD)', 'Pay Token']);

  walletAddresses.forEach(walletAddress => {
    chains.forEach(chainId => {
      fetchNFTs(walletAddress, chainId, sheet);
    });
  });
}

function fetchNFTs(walletAddress, chainId, sheet) {
  const url = `https://pro-openapi.debank.com/v1/user/nft_list?id=${walletAddress}&chain_id=${chainId}&is_all=false`;
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
    Logger.log(`NFT Data for wallet ${walletAddress} on chain ${chainId}: ${JSON.stringify(data)}`);

    if (!data || !data.length) {
      Logger.log(`No NFT data found for wallet ${walletAddress} on chain ${chainId}`);
      return;
    }

    const collections = {};

    data.forEach((nft) => {
      const collectionName = nft.contract_name || 'Unknown Collection';
      if (!collections[collectionName]) {
        collections[collectionName] = {
          walletAddress,
          chainId,
          collectionName,
          totalNFTs: 0,
          totalETHSpent: 0,
          totalUSDValue: 0,
          change24h: 0
        };
      }

      const valueETH = nft.floor_price ? nft.floor_price : 0;
      const valueUSD = valueETH * ethPrice;
      const refundValue = nft.pay_token ? nft.pay_token.amount / Math.pow(10, nft.pay_token.decimals) : 0;
      const lastTradePrice = nft.last_trade_price ? nft.last_trade_price.usd : 0;
      const change24h = nft.price_24h_change * 100; // Convert to percentage

      collections[collectionName].totalNFTs += 1;
      collections[collectionName].totalETHSpent += refundValue;
      collections[collectionName].totalUSDValue += valueUSD;
      collections[collectionName].change24h += change24h;
    });

    Object.values(collections).forEach((collection) => {
      sheet.appendRow([
        collection.walletAddress,
        collection.collectionName,
        collection.chainId,
        collection.totalNFTs,
        collection.totalETHSpent,
        collection.totalUSDValue,
        collection.change24h.toFixed(2)
      ]);
    });

  } catch (error) {
    Logger.log(`Error fetching NFTs for wallet ${walletAddress} on chain ${chainId}: ${error.message}`);
  }
}

function getEthPrice() {
  const url = `https://api.etherscan.io/api?module=stats&action=ethprice&apikey=${ETHERSCAN_API_KEY}`;

  try {
    const response = UrlFetchApp.fetch(url);
    const data = JSON.parse(response.getContentText());
    return parseFloat(data.result.ethusd);
  } catch (error) {
    Logger.log(`Error fetching ETH price: ${error.message}`);
    return 0;
  }
}

function updateAllData() {
  fetchRawData();
}
