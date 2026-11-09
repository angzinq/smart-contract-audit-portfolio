// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

// OpenZeppelin 标准 ERC721 实现，提供 NFT 的基础能力：
// 例如铸造、转账、授权、余额查询、所有者查询等。
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
// ERC721URIStorage 在 ERC721 基础上增加了每个 token 独立存储 URI 的能力，
// 适合当前这种每个 NFT 都要绑定单独元数据地址的场景。
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

// NFT 合约继承了 ERC721 和 ERC721URIStorage：
// 1. ERC721 负责 NFT 标准行为
// 2. ERC721URIStorage 负责每个 NFT 的元数据 URI 存储
contract NFT is ERC721, ERC721URIStorage {
    // 合约拥有者地址。
    // 当前合约通过它限制只有部署者才能执行特定管理操作，例如批量铸造和转移。
    address public owner;

    // NFT 最大可铸造数量上限。
    // 在构造函数中初始化，用来控制总发行量，避免无限增发。
    uint256 maxTokenCount = 0;

    // 当前已经铸造出的 token 数量计数器。
    // 这里同时也被用来辅助生成新的 tokenId。
    uint256 public _currentCounter = 0;

    // 保存所有已经铸造出的 tokenId，便于前端或调用方批量读取。
    uint256[] public tokenids;

    // Artwork 用于描述某个 NFT 对应的作品信息。
    // 这些字段相当于链上的业务元数据，和 tokenURI 指向的链下 JSON 形成互补。
    struct Artwork {
        // 作品名称
        string name;
        // 作品编号/序列号
        string sn;
        // 作品价格
        uint256 price;
        // 作品描述
        string description;
        // 作品创建时间，当前设计为字符串，方便直接存储文本格式时间
        string createTime;
        // 该 NFT 的元数据地址，通常指向 IPFS 或其他可访问资源
        string tokenURI;
    }

    // 根据 tokenId 存储对应作品信息。
    // 通过 tokenId 可以查询该 NFT 的完整业务数据。
    mapping(uint256 => Artwork) public artworks;

    // 用于记录已经设置过元数据的 token 数量。
    // 当前 setTokenURI 会基于这个计数器来给 token 绑定元数据。
    uint256 public _tokenIdsCount = 0;

    // 自定义权限修饰器：
    // 只有合约拥有者才能调用带有 OnlyOwner 的函数。
    modifier OnlyOwner() {
        require(msg.sender == owner, "contract owner is not equal msg.sender");
        _;
    }

    // 构造函数在部署合约时执行一次。
    // 参数说明：
    // _name: NFT 集合名称，例如 "MyNFT"
    // _symbol: NFT 简称，例如 "MNFT"
    // _tokenCounter: 允许铸造的最大数量
    //
    // ERC721(_name, _symbol) 会把名称和简称初始化到父合约中。
    constructor(
        string memory _name,
        string memory _symbol,
        uint256 _tokenCounter
    ) ERC721(_name, _symbol) {
        // 设置 NFT 最大发行量
        maxTokenCount = _tokenCounter;
        // 将部署者设置为合约拥有者
        owner = msg.sender;
    }

    // 批量铸造 NFT。
    // 只有合约拥有者可以调用。
    //
    // 参数 _tokenCounter 表示本次要新铸造多少个 NFT。
    // 函数执行后，新铸造的 token 会直接分配给调用者（即 owner）。
    function mint(uint256 _tokenCounter) public OnlyOwner returns (bool) {
        // 确保本次铸造后，总数不会超过最大上限。
        require(_currentCounter + _tokenCounter <= maxTokenCount, "Max supply reached");

        // 先读取当前计数，后续在循环中逐个递增生成 tokenId。
        uint256 tokenID = _currentCounter;

        for (uint256 i = 0; i < _tokenCounter; i++) {
            // 每循环一次生成一个新的 tokenId。
            tokenID++;
            // _mint 是 ERC721 的内部铸造函数，
            // 会创建 token 并把它分配给 msg.sender。
            _mint(msg.sender, tokenID);
            // 记录已铸造的 tokenId，方便外部查看。
            tokenids.push(tokenID);
        }

        // 更新当前总铸造计数。
        _currentCounter += _tokenCounter;
        return true;
    }

    // 为某个 token 设置作品信息和元数据 URI。
    //
    // 当前实现不是通过传入 tokenId 来指定目标 NFT，
    // 而是使用 _tokenIdsCount 自增后作为被设置的 tokenId。
    // 因此它默认假设“设置元数据的顺序”和“铸造顺序”是一一对应的。
    function setTokenURI(
        string memory name,
        string memory sn,
        uint256 price,
        string memory description,
        string memory createTime,
        string memory _tokenURI
    ) public returns (bool) {
        // 以下 require 用于做基础参数校验，避免写入空字符串数据。
        require(bytes(name).length > 0, "NFT: name cannot be empty");
        require(bytes(sn).length > 0, "NFT: serial number cannot be empty");
        require(bytes(description).length > 0, "NFT: description cannot be empty");
        require(bytes(_tokenURI).length > 0, "NFT: tokenURI cannot be empty");
        require(bytes(createTime).length > 0, "NFT: createTime cannot be empty");

        // 递增元数据计数器，表示现在要给下一个 token 绑定信息。
        _tokenIdsCount++;

        // 调用 ERC721URIStorage 的内部方法，为指定 token 设置 URI。
        _setTokenURI(_tokenIdsCount, _tokenURI);

        // 同时把业务层作品信息写入 artworks 映射中，供后续查询。
        artworks[_tokenIdsCount] = Artwork({
            name: name,
            sn: sn,
            price: price,
            description: description,
            createTime: createTime,
            tokenURI: _tokenURI
        });

        return true;
    }

    // 重写 tokenURI 是因为合约同时继承了 ERC721 和 ERC721URIStorage，
    // Solidity 需要显式指定最终采用哪个父类的实现。
    // 这里直接调用 super，实际会走 ERC721URIStorage 的逻辑。
    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    // 重写 supportsInterface 同样是为了解决多重继承下的方法冲突。
    // 它用于判断合约是否支持某个接口 ID，是 ERC721 标准兼容性检查的一部分。
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    // 该函数先授权，再把指定 token 从 owner 转给目标地址。
    // 只有合约拥有者可以调用。
    //
    // approve(to, tokenID) 表示授权 to 可以操作该 token。
    // transferFrom(msg.sender, to, tokenID) 表示把 token 从当前 owner 转移给 to。
    function _appoveToken(uint256 tokenID, address to) public OnlyOwner returns (uint256) {
        approve(to, tokenID);
        transferFrom(msg.sender, to, tokenID);
        return tokenID;
    }

    // 根据 tokenId 查询当前 NFT 绑定的作品信息。
    // 返回值顺序依次为：
    // name, sn, description, tokenURI, price, createTime
    function getTokenInfo(uint256 tokenID)
        public
        view
        returns (
            string memory,
            string memory,
            string memory,
            string memory,
            uint256,
            string memory
        )
    {
        return (
            artworks[tokenID].name,
            artworks[tokenID].sn,
            artworks[tokenID].description,
            artworks[tokenID].tokenURI,
            artworks[tokenID].price,
            artworks[tokenID].createTime
        );
    }
}