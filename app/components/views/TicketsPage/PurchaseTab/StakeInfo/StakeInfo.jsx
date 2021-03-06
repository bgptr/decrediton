import { useState } from "react";
import StakeInfoDisplay from "./StakeInfoDisplay";
import { useStakeInfo } from "./hooks";

const StakeInfo = () => {
  const {
    ownMempoolTicketsCount,
    immatureTicketsCount,
    liveTicketsCount,
    unspentTicketsCount,
    isSPV,
    lastVotedTicket,
    ...other
  } = useStakeInfo();
  const [isShowingDetails, setIsShowingDetails] = useState(false);
  const onToggleStakeinfo = () => setIsShowingDetails((p) => !p);

  return (
    <StakeInfoDisplay
      {...{
        ownMempoolTicketsCount,
        immatureTicketsCount,
        liveTicketsCount,
        unspentTicketsCount,
        isSPV,
        lastVotedTicket,
        isShowingDetails,
        onToggleStakeinfo,
        ...other
      }}
    />
  );
};

export default StakeInfo;
