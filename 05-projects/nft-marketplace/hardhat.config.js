require("@nomicfoundation/hardhat-toolbox");

module.exports = {
  solidity: {
    version: "0.8.28",
    settings: {
      evmVersion: "cancun",// 以太坊虚拟机新的版本，生成字节码
      optimizer: {
        enabled: true, //表示开启优化器
        runs: 200  //优化器的“运行次数假设值”。
      }
    }
  },
  networks: {
    ganache: {
      url: "http://127.0.0.1:7545",
      chainId: 1337
    }
  }
};