// loadFixture 用于创建并复用测试快照。
// 这样每个测试都可以从同一个初始状态开始，执行更快，也更稳定。
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
// chai 的 expect 断言库，用来验证测试结果是否符合预期。
const { expect } = require("chai");

// 针对 NFT 合约的测试集合。
describe("NFT", function () {
    // 统一准备一份默认元数据，避免在多个测试里重复书写相同参数。
    // 这组数据会被 setTokenURI 相关测试重复使用。
    const metadata = {
        name: "Sunrise",
        sn: "ART-001",
        price: 1000,
        description: "A warm sunrise painting",
        createTime: "2026-06-07",
        uri: "ipfs://sunrise-001",
    };

    // 部署一个全新的 NFT 合约，并准备几个测试账户。
    // 这里返回的对象会被 fixture 机制缓存，供后续测试按需复用。
    async function deployNFTFixture() {
        // 获取测试网络中的签名账户：
        // owner 通常作为合约部署者和默认 owner，
        // user1、user2 用于模拟普通用户或转账接收方。
        const [owner, user1, user2] = await ethers.getSigners();

        // 获取 NFT 合约工厂，用它来部署合约实例。
        const NFT = await ethers.getContractFactory("NFT");

        // 部署 NFT 合约：
        // "MyNFT" 是集合名称
        // "MNFT" 是集合符号
        // 5 表示最多允许铸造 5 个 NFT
        const nft = await NFT.deploy("MyNFT", "MNFT", 5);

        // 等待合约真正部署完成，确保后续调用不会因部署未完成而失败。
        await nft.waitForDeployment();

        return { nft, owner, user1, user2 };
    }

    // 在“已经部署好的合约”基础上，额外先铸造 2 个 NFT。
    // 适合那些需要“链上已经存在 token”作为前置条件的测试。
    async function deployMintedNFTFixture() {
        const fixture = await deployNFTFixture();
        await fixture.nft.mint(2);
        return fixture;
    }

    // 给合约设置一份默认的 token 元数据。
    // 如果传入 signer，就使用该账户发起交易；
    // 如果不传，则默认使用合约当前绑定的默认 signer。
    async function setDefaultTokenURI(contract, signer) {
        // connect(signer) 的作用是切换交易发送者，
        // 用于验证“不同账户调用时是否会有权限差异”。
        const target = signer ? contract.connect(signer) : contract;
        return target.setTokenURI(
            metadata.name,
            metadata.sn,
            metadata.price,
            metadata.description,
            metadata.createTime,
            metadata.uri
        );
    }

    // 1.测试“部署阶段”的基本行为是否正确。
    describe("Deployment", function () {
        // 验证构造函数是否正确设置了：
        // 集合名称、集合符号、owner 地址，以及两个计数器的初始值。
        it("sets the collection metadata and owner", async function () {
            const { nft, owner } = await loadFixture(deployNFTFixture);

            expect(await nft.name()).to.equal("MyNFT");
            expect(await nft.symbol()).to.equal("MNFT");
            expect(await nft.owner()).to.equal(owner.address);
            expect(await nft._currentCounter()).to.equal(0);
            expect(await nft._tokenIdsCount()).to.equal(0);
        });
    });

    // 2. 测试 mint 铸造逻辑。
    describe("Mint", function () {
        // 验证 owner 是否可以一次性连续铸造多个 NFT。
        // 同时检查：
        // 1. 是否触发了 ERC721 的 Transfer 事件
        // 2. tokenId 是否按顺序递增
        // 3. owner 是否正确持有这些 token
        // 4. tokenids 数组是否记录了这些 tokenId
        it("allows the contract owner to mint multiple NFTs in sequence", async function () {
            const { nft, owner } = await loadFixture(deployNFTFixture);

            await expect(nft.mint(2))
                .to.emit(nft, "Transfer")
                .withArgs(ethers.ZeroAddress, owner.address, 1);

            expect(await nft._currentCounter()).to.equal(2);
            expect(await nft.ownerOf(1)).to.equal(owner.address);
            expect(await nft.ownerOf(2)).to.equal(owner.address);
            expect(await nft.tokenids(0)).to.equal(1);
            expect(await nft.tokenids(1)).to.equal(2);
        });

        // 验证多次分批铸造时，计数器是否能够持续累加，
        // 并最终在达到上限前保持正常工作。
        it("supports incremental minting until the max supply is reached", async function () {
            const { nft, owner } = await loadFixture(deployNFTFixture);

            await nft.mint(2);
            await nft.mint(3);

            expect(await nft._currentCounter()).to.equal(5);
            expect(await nft.ownerOf(5)).to.equal(owner.address);
        });

        // 验证非 owner 调用 mint 时会被拒绝。
        // 这是对 OnlyOwner 修饰器行为的直接测试。
        it("rejects minting by a non-owner", async function () {
            const { nft, user1 } = await loadFixture(deployNFTFixture);

            await expect(nft.connect(user1).mint(1)).to.be.revertedWith(
                "contract owner is not equal msg.sender"
            );
        });

        // 验证铸造数量不能超过构造函数中设定的最大供应量。
        // 这里先把 5 个额度全部用完，再尝试多铸造 1 个，应当回退。
        it("rejects minting beyond the max supply", async function () {
            const { nft } = await loadFixture(deployNFTFixture);

            await nft.mint(5);
            await expect(nft.mint(1)).to.be.revertedWith("Max supply reached");
        });
    });

    // 3.测试 NFT 元数据写入和读取逻辑。
    describe("Metadata", function () {
        // 验证 setTokenURI 是否会：
        // 1. 推进 _tokenIdsCount
        // 2. 给对应 token 写入 URI
        // 3. 把业务元数据写入 artworks 映射
        // 4. 允许通过 getTokenInfo 取回完整信息
        it("stores metadata under the internal metadata counter and exposes it through getTokenInfo", async function () {
            const { nft } = await loadFixture(deployMintedNFTFixture);

            await setDefaultTokenURI(nft);

            expect(await nft._tokenIdsCount()).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(metadata.uri);

            const tokenInfo = await nft.getTokenInfo(1);
            expect(tokenInfo[0]).to.equal(metadata.name);
            expect(tokenInfo[1]).to.equal(metadata.sn);
            expect(tokenInfo[2]).to.equal(metadata.description);
            expect(tokenInfo[3]).to.equal(metadata.uri);
            expect(tokenInfo[4]).to.equal(metadata.price);
            expect(tokenInfo[5]).to.equal(metadata.createTime);
        });

        // 验证当前合约实现中，setTokenURI 并没有 owner 权限限制。
        // 也就是说，普通账户也可以写入元数据。
        // 这是“当前行为”的测试，不一定代表这是最佳设计。
        it("does not require the caller to be the contract owner", async function () {
            const { nft, user1 } = await loadFixture(deployMintedNFTFixture);

            await expect(setDefaultTokenURI(nft, user1)).not.to.be.reverted;
            expect(await nft._tokenIdsCount()).to.equal(1);
            expect(await nft.tokenURI(1)).to.equal(metadata.uri);
        });

        // 验证当前合约不是通过“外部传入 tokenId”来绑定元数据，
        // 而是通过内部计数器 _tokenIdsCount 顺序写入。
        // 这个测试能帮助我们看清当前设计的真实行为。
        it("binds metadata writes to _tokenIdsCount instead of a caller-supplied token id", async function () {
            const { nft } = await loadFixture(deployMintedNFTFixture);

            await setDefaultTokenURI(nft);
            await nft.setTokenURI(
                "Moonlight",
                "ART-002",
                2000,
                "A quiet moonlight painting",
                "2026-06-08",
                "ipfs://moonlight-002"
            );

            expect(await nft._tokenIdsCount()).to.equal(2);
            expect(await nft.tokenURI(1)).to.equal(metadata.uri);
            expect(await nft.tokenURI(2)).to.equal("ipfs://moonlight-002");
        });

        // 验证关键字段不能为空。
        // 这里只测试了两个代表性字段：
        // name 不能为空，tokenURI 不能为空。
        // 其他字段在合约里也有类似 require 校验。
        it("validates required metadata fields", async function () {
            const { nft } = await loadFixture(deployMintedNFTFixture);

            await expect(
                nft.setTokenURI("", metadata.sn, metadata.price, metadata.description, metadata.createTime, metadata.uri)
            ).to.be.revertedWith("NFT: name cannot be empty");

            await expect(
                nft.setTokenURI(metadata.name, metadata.sn, metadata.price, metadata.description, metadata.createTime, "")
            ).to.be.revertedWith("NFT: tokenURI cannot be empty");
        });

        // 验证一个比较特殊的行为：
        // 当前合约允许“先写元数据，后铸造 token”。
        // 但在 token 真正被 mint 出来之前，调用 tokenURI(tokenId) 仍然会回退，
        // 因为 ERC721 视角里这个 token 还不存在。
        it("can record metadata before a token is minted, but tokenURI still reverts until minting happens", async function () {
            const { nft, user1 } = await loadFixture(deployNFTFixture);

            await setDefaultTokenURI(nft, user1);
            await expect(nft.tokenURI(1)).to.be.reverted;

            await nft.mint(1);
            expect(await nft.tokenURI(1)).to.equal(metadata.uri);
        });
    });

    // 4. 测试合约中封装的转移辅助函数 _appoveToken。
    describe("Transfer helper", function () {
        // 验证 owner 是否可以通过 _appoveToken：
        // 1. 授权目标地址
        // 2. 将指定 token 转移给目标地址
        // 3. 正确触发 Transfer 事件
        it("transfers a minted token to another address through _appoveToken", async function () {
            const { nft, owner, user1 } = await loadFixture(deployMintedNFTFixture);

            await expect(nft._appoveToken(1, user1.address))
                .to.emit(nft, "Transfer")
                .withArgs(owner.address, user1.address, 1);

            expect(await nft.ownerOf(1)).to.equal(user1.address);
        });

        // 验证非 owner 无法调用 _appoveToken。
        // 这同样是在检查 OnlyOwner 权限控制是否生效。
        it("rejects transfer helper calls from a non-owner", async function () {
            const { nft, user1, user2 } = await loadFixture(deployMintedNFTFixture);

            await expect(
                nft.connect(user1)._appoveToken(1, user2.address)
            ).to.be.revertedWith("contract owner is not equal msg.sender");
        });
    });
});