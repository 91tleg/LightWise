#ifndef SRC_COMMON_UTILS_MATH_KALMAN1D_HPP
#define SRC_COMMON_UTILS_MATH_KALMAN1D_HPP

namespace filter
{

/* Scalar Kalman filter, random-walk process model. */
class Kalman1D
{
public:
    constexpr explicit Kalman1D( float q ) noexcept : q_ { q } {}

    void reset( float z, float r ) noexcept
    {
        x_ = z;
        p_ = r;
        init_ = true;
    }

    void predict() noexcept { p_ += q_; }

    /* Normalized innovation squared for a candidate measurement */
    float nis( float z, float r ) const noexcept
    {
        const float y { z - x_ };
        return ( y * y ) / ( p_ + r );
    }

    void update( float z, float r ) noexcept
    {
        const float k { p_ / ( p_ + r ) };
        x_ += k * ( z - x_ );
        p_ *= ( 1.0f - k );
    }

    /* Widen uncertainty so a real step change is accepted quickly */
    void inflate( float extra ) noexcept { p_ += extra; }

    float x() const noexcept { return x_; }
    float p() const noexcept { return p_; }
    bool  initialized() const noexcept { return init_; }

private:
    float q_;
    float x_ { 0.0f };
    float p_ { 0.0f };
    bool  init_ { false };
};

} /* namespace filter */

#endif /* SRC_COMMON_UTILS_MATH_KALMAN1D_HPP */
