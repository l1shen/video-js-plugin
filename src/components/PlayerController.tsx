import { debounce } from "lodash-es";
import React, { Component } from "react";
import video_pause from "./icons/video_pause.svg";
import video_play from "./icons/video_play.svg";
import volume0 from "./icons/vulme0.svg";
import volume1 from "./icons/vulme1.svg";
import volume2 from "./icons/vulme2.svg";
import "./PlayerController.css";
import SeekSlider from "./SeekSlider";

export type PlayerControllerProps = {
    fullTime: number; // ms
    progressTime: number;
    play: () => void;
    pause: () => void;
    paused: boolean;
    seekTime: (time: number) => void;
    handleVolume: (data: number) => void;
    volume: number;
    bufferProgress: number;
    isDisplay: boolean;
};

export type PlayerControllerStates = {
    isPlayerSeeking: boolean;
    currentTime: number;
    isVolumeHover: boolean;
    seekVolume: number;
    isDisplay: boolean;
};

export default class PlayerController extends Component<
    PlayerControllerProps,
    PlayerControllerStates
> {
    private progressTime: number = 0;
    private stageVolume: number = 0;
    private updateVolumeTimer = 0;
    private onVolumeSeeking: boolean = false;

    public constructor(props: PlayerControllerProps) {
        super(props);
        this.state = {
            isPlayerSeeking: false,
            currentTime: 0,
            isVolumeHover: false,
            seekVolume: 1,
            isDisplay: true,
        };
        this.stageVolume = props.volume;
    }

    public componentDidMount(): void {
        this.updateVolumeTimer = setInterval(() => {
            if (!this.onVolumeSeeking) {
                this.setState({ seekVolume: this.props.volume });
            }
        }, 100);
    }

    public componentWillUnmount() {
        if (this.updateVolumeTimer) {
            clearInterval(this.updateVolumeTimer);
        }
    }

    private onClickOperationButton = (): void => {
        const { paused } = this.props;
        if (paused) {
            this.props.play();
        } else {
            this.props.pause();
        }
    };

    private getCurrentTime = (progressTime: number): number => {
        if (this.state.isPlayerSeeking) {
            this.progressTime = progressTime;
            return this.state.currentTime;
        } else {
            const isChange = this.progressTime !== progressTime;
            if (isChange) {
                return progressTime;
            } else {
                return this.state.currentTime;
            }
        }
    };

    private operationButton = (): React.ReactNode => {
        const { paused } = this.props;
        if (paused) {
            return <img src={video_play} />;
        } else {
            return <img src={video_pause} />;
        }
    };

    private operationVolumeButton = (): React.ReactNode => {
        if (this.props.volume === 1) {
            return <img src={volume2} />;
        } else if (this.props.volume === 0) {
            return <img src={volume0} />;
        } else {
            return <img src={volume1} />;
        }
    };

    private handleClickVolume = (): void => {
        if (this.props.volume === 0) {
            if (this.stageVolume !== 0) {
                this.props.handleVolume(this.stageVolume);
            } else {
                this.props.handleVolume(1);
            }
        } else {
            this.stageVolume = this.props.volume;
            this.props.handleVolume(0);
        }
    };

    private onChange = debounce((time: number, offsetTime: number) => {
        this.props.seekTime(time);
    }, 50);

    private onVolumeChange = (time: number, offsetTime: number) => {
        this.setState({ seekVolume: time / 100 });
        this.changeVolume(time);
    };

    private changeVolume = debounce((time: number) => {
        this.props.handleVolume(time / 100);
    }, 50);

    private onVolumeSeekStart = () => {
        this.onVolumeSeeking = true;
    };

    private onVolumeSeekEnd = () => {
        this.onVolumeSeeking = false;
    };

    public render(): React.ReactNode {
        const { fullTime, progressTime } = this.props;
        return (
            <div
                className="player-schedule"
                style={{ display: this.props.isDisplay ? "block" : "none" }}
            >
                <div className="player-mid-box">
                    <SeekSlider
                        fullTime={fullTime}
                        currentTime={this.getCurrentTime(progressTime)}
                        onChange={this.onChange}
                        bufferProgress={this.props.bufferProgress}
                        bufferColor={"rgba(255,255,255,0.3)"}
                        hideHoverTime={true}
                        limitTimeTooltipBySides={true}
                        play={this.props.play}
                        pause={this.props.pause}
                        paused={this.props.paused}
                    />
                </div>
                <div className="player-controller-box">
                    <div className="player-controller-mid">
                        <div className="player-left-box">
                            <div
                                onClick={() => {
                                    this.onClickOperationButton();
                                }}
                                className="player-controller"
                            >
                                {this.operationButton()}
                            </div>
                            <div
                                className="player-volume-box"
                                onMouseEnter={() => {
                                    this.setState({
                                        isVolumeHover: true,
                                    });
                                }}
                                onMouseLeave={() => {
                                    this.setState({
                                        isVolumeHover: false,
                                    });
                                }}
                            >
                                <div onClick={this.handleClickVolume} className="player-volume">
                                    {this.operationVolumeButton()}
                                </div>
                                <div className="player-volume-slider">
                                    <SeekSlider
                                        fullTime={100}
                                        currentTime={100 * this.state.seekVolume}
                                        onChange={this.onVolumeChange}
                                        hideHoverTime={true}
                                        limitTimeTooltipBySides={true}
                                        onSeekStart={this.onVolumeSeekStart}
                                        onSeekEnd={this.onVolumeSeekEnd}
                                    />
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="player-mid-box-time">
                                {displayWatch(Math.floor(progressTime / 1000))} /{" "}
                                {displayWatch(Math.floor(fullTime / 1000))}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }
}

function displayWatch(seconds: number): string {
    const displaySeconds = seconds % 60;
    const minutes = (seconds - displaySeconds) / 60;

    if (minutes >= 60) {
        const displayMinutes = minutes % 60;
        const hours = (minutes - displayMinutes) / 60;

        return `${updateNumber(hours)} : ${updateNumber(displayMinutes)} : ${updateNumber(
            displaySeconds
        )}`;
    } else {
        return `${updateNumber(minutes)} : ${updateNumber(displaySeconds)}`;
    }
}

function updateNumber(time: number): string {
    if (time <= 9) {
        return `0${time}`;
    } else {
        return `${time}`;
    }
}
